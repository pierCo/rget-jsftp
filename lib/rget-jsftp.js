var fs = require('fs');
var path = require('path');
var FTPPool = require('./_pool');
var Helper = require('./_helper');
var DownloadContext = require('./_downloadContext');

var RGet = function (params, logger) {
    "use strict";

    if (typeof params === 'undefined') {
        throw new Error('No parameters defined.');
    }

    var LOG = Helper.logger(logger);

    var rgetParams = Helper.createAndMergeDefaultObjectAndData(RGet.DEFAULT_PARAM, params);

    var shortFtpPool = FTPPool.Pool('shortFtpPool', rgetParams, rgetParams.maxShortConnections, rgetParams.idleShortConnection, logger);
    var longFtpPool = FTPPool.Pool('longFtpPool', rgetParams, rgetParams.maxLongConnections, rgetParams.idleLongConnection, logger);

    function startDownload(downloadContext) {
        "use strict";
        var source = downloadContext.source;
        Helper.ftpCmd('ls', shortFtpPool, source, function (err, files) {
            if (emitErrorIfError(downloadContext, err)) {
                return;
            }
            if (files.length == 1 && files[0].type == 0) {
                // source is maybe a file or a folder ?
                var theFile = files[0];
                var testIfSourceIsNotAFolder = path.join(source, theFile.name);
                var ctx = downloadContext;
                Helper.ftpCmd('ls', shortFtpPool, testIfSourceIsNotAFolder, function (err) {
                    if (err && err.code === 550) {
                        // Source is a file because source test not exists
                        addToCtxAndDownloadFile(ctx, ctx.source, theFile.size);
                        emitInitializedIfOk(ctx);
                    } else if (err) {
                        emitErrorIfError(ctx, err);
                        return;
                    } else {
                        // Source is a folder
                        addToCtxAndExploreFolder(ctx, ctx.source);
                    }
                });
            } else {
                // source is a folder
                addToCtxAndExploreFolder(downloadContext, source);
            }
        });
    }

    function addToCtxAndDownloadFile(downloadContext, source, size) {
        LOG.info('RGet > File added to download list : %s', source);
        var fileToDownload = downloadContext.addFile(source, size);
        downloadContext.emit('fileAdded', fileToDownload);
        downloadFile(downloadContext, fileToDownload);
    }

    function addToCtxAndExploreFolder(downloadContext, source) {
        var folderToDownload = downloadContext.addFolder(source);
        downloadContext.emit('folderAdded', folderToDownload);
        exploreAndDownload(downloadContext, folderToDownload);
    }

    function emitInitializedIfOk(downloadContext) {
        if (downloadContext.getNotExploredFolders() == 0) {
            downloadContext.emit('initialized');
            return true;
        } else {
            return false;
        }
    }

    function emitErrorIfError(downloadContext, err) {
        if (typeof err !== 'undefined' && err != null) {
            downloadContext.emit('error', err);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Explore FTP source (defined in downloadContext) and download all files (and folder) it contains.
     * @param downloadContext All information about download. This object is update during the download actions.
     * @param folder folder contained in the FTP source.
     */
    function exploreAndDownload(downloadContext, folder) {
        "use strict";
        var source = downloadContext.getFolderSource(folder);
        LOG.info('RGet > Folder : %s', source);
        Helper.ftpCmd('ls', shortFtpPool, source, function (err, files) {
            if (emitErrorIfError(downloadContext, err)) {
                return;
            }
            var src = source;
            var ctx = downloadContext;
            files.forEach(function (file) {
                var fileSource = path.join(src, file.name);
                if (file.type === 0) {
                    addToCtxAndDownloadFile(ctx, fileSource, file.size);
                } else {
                    addToCtxAndExploreFolder(ctx, fileSource);
                }
            });
            LOG.info('RGet > Folder explored : %s', source);
            folder.explored = true;
            downloadContext.emit('folderExplored', folder);
            emitInitializedIfOk(downloadContext);
        });
    }

    function downloadFile(downloadContext, file) {
        "use strict";
        var to = downloadContext.getFileDestination(file);
        if (fs.existsSync(to)) {
            var stats = fs.statSync(to);
            var fsFileSize = stats.size;
            if (fsFileSize == file.size) {
                file.complete = fsFileSize;
                LOG.info('RGet > Already downloaded : %s', to);
                emitFinishedIfOk(downloadContext, file);
            } else {
                LOG.info('RGet > Exists : %s', to);
                fs.unlinkSync(to);
                createAndDownloadFile(downloadContext, file);
            }
        } else {
            Helper.rMkdir(path.dirname(to));
            createAndDownloadFile(downloadContext, file);
        }
    }

    /**
     * This function creates the file and its folders (if the file is into a folder on the FTP) on your filesystem and write its data contained in the FTP.
     * @param downloadContext All information about download. This object is updated during the download actions.
     * @param file the file to download
     */
    function createAndDownloadFile(downloadContext, file) {
        "use strict";
        var from = downloadContext.getFileDestination(file);
        var to = downloadContext.getFileSource(file);
        longFtpPool.acquire(function (err, ftp) {
            if (emitErrorIfError(downloadContext, err)) {
                return;
            }
            var downloadFile = file;
            var ctx = downloadContext;
            ctx.emit('downloadStart', downloadFile);
            ftp.get(to, function (err, socket) {
                if (err) {
                    ctx.emit('errorWithFile', err, downloadFile);
                    return
                }
                LOG.info('RGet > Download started : %s', from);
                var lastDataEventLength = 0;
                var context = ctx;
                var fileBeingDownload = downloadFile;
                socket.on('data', function (data) {
                    fs.appendFile(from, data, function () {
                        fileBeingDownload.complete += data.length;
                        lastDataEventLength += data.length;
                        if (lastDataEventLength > rgetParams.stepDataEvent) {
                            LOG.debug('RGet > Data received : %s (%d bytes on %d bytes)', from, fileBeingDownload.complete, fileBeingDownload.size);
                            lastDataEventLength = 0;
                            context.emit('dataReceived', fileBeingDownload);
                        }
                        emitFinishedIfOk(context, fileBeingDownload);
                    });
                });
                socket.on('close', function (err) {
                    longFtpPool.release(ftp);
                    if (err) {
                        context.emit('errorDownload', err, fileBeingDownload);
                    }
                });
                socket.resume();
            });
        });
    }

    function emitFinishedIfOk(ctx, file) {
        "use strict";
        if (file.isComplete()) {
            LOG.info('RGet > Download finished : %s', ctx.getFileDestination(file));
            ctx.emit('downloadFinished', file);
            if (ctx.getNotDownloadedFiles().length === 0) {
                ctx.emit('finished');
            }
        }
    }


    return {
        "generateDownloadContext": function (source, destination) {
            return DownloadContext.instantiate(source, destination);
        },
        /**
         * Download source file or folder into destination folder.
         * @param source File or folder path.
         * @param destination Folder path where the files will be written.
         * @returns The information of download : files, folders, size, downloaded size, ...
         * Events list :
         *  - initialized
         *  - folderAdded
         *  - folderExplored
         *  - fileAdded
         *  - downloadStart
         *  - dataReceived
         *  - downloadFinished
         *  - finished
         *  - error
         *  - errorWithFile
         */
        'download': function (downloadContexte) {
            LOG.info('RGet > Download started : GET %s (FTP) TO %s (FS)', downloadContexte.source, downloadContexte.destination);
            downloadContexte.initialized();
            startDownload(downloadContexte);
            return downloadContexte;
        },
        'destroy': function () {
            shortFtpPool.destroy();
            longFtpPool.destroy();
        }
    }

};

module.exports.RGet = RGet;

RGet.DEFAULT_PARAM = {
    'stepDataEvent': 5000000,
    'maxShortConnections': 4,
    'maxLongConnections': 4,
    'idleShortConnection': 30000,
    'idleLongConnection': 30000,
    'host': '',
    'port': 21,
    'username': '',
    'password': ''
};
