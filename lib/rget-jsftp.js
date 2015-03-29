var fs = require('fs');
var path = require('path');
var FTPPool = require('./_pool');
var Helper = require('./_helper');
var DownloadContext = require('./_downloadContext');

"use strict";

var RGet = function (params, logger) {

    if (typeof params === 'undefined') {
        throw new Error('No parameters defined.');
    }

    var LOG = Helper.logger(logger);

    var rgetParams = Helper.createAndMergeDefaultObjectAndData(RGet.DEFAULT_PARAM, params);

    var shortFtpPool = FTPPool.Pool('shortFtpPool', rgetParams, rgetParams.maxShortConnections, rgetParams.idleShortConnection, logger);
    var longFtpPool = FTPPool.Pool('longFtpPool', rgetParams, rgetParams.maxLongConnections, rgetParams.idleLongConnection, logger);

    function startDownload(downloadContext) {
        var source = downloadContext.source;
        Helper.ftpCmd('ls', shortFtpPool, source, function (err, files) {
            if (emitErrorIfError(downloadContext, err)) {
                return;
            }
            if (files.length == 1 && files[0].type == 0) {
                // source is maybe a file or a folder
                // because files[0] can be a child of source if source is a folder
                // or file[0] can be the source file description if source is a file
                var theFile = files[0];
                if (source === theFile.name) {
                    // If the FTP service run on Linux
                    addToCtxAndDownloadFile(downloadContext, source, theFile.size);
                    emitInitializedIfOk(downloadContext);
                } else {
                    // With other OS ? (Mac OS X during my test)
                    Helper.ftpCmd('ls', shortFtpPool, path.join(source, theFile.name), function (err) {
                        if (err) {
                            if (err.code === 450 || err.code === 550) {
                                addToCtxAndDownloadFile(downloadContext, source, theFile.size);
                                emitInitializedIfOk(downloadContext);
                            } else {
                                emitErrorIfError(downloadContext, err);
                            }
                        } else {
                            addToCtxAndExploreFolder(downloadContext, source);
                        }
                    });
                }
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
        var to = downloadContext.getFileDestination(file);
        var from = downloadContext.getFileSource(file);
        longFtpPool.acquire(function (err, ftp) {
            if (emitErrorIfError(downloadContext, err)) {
                return;
            }
            downloadContext.emit('downloadStart', file);
            ftp.get(from, function (err, socket) {
                if (err) {
                    longFtpPool.release(ftp);
                    downloadContext.emit('errorWithFile', err, file);
                    return
                }

                LOG.info('RGet > Download started : %s', to);

                var writeStream = fs.createWriteStream(to);
                writeStream.on('error', function (err) {
                    downloadContext.emit('errorWithFile', err, file);
                });
                writeStream.on('finish', function () {
                    emitFinishedIfOk(downloadContext, file);
                });

                var lastDataEventLength = 0;
                socket.on('data', function (data) {
                    file.complete += data.length;
                    lastDataEventLength += data.length;
                    if (lastDataEventLength > rgetParams.stepDataEvent) {
                        LOG.debug('RGet > Data received : %s (%d bytes on %d bytes)', to, file.complete, file.size);
                        lastDataEventLength = 0;
                        downloadContext.emit('dataReceived', file);
                    }
                });
                socket.on('error', function () {
                    downloadContext.emit('errorWithFile', err, file);
                });
                socket.on('end', function () {
                    longFtpPool.release(ftp);
                });
                socket.pipe(writeStream);
                socket.resume();

            });
        });
    }

    function emitFinishedIfOk(ctx, file) {
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
         * @param downloadContext Download context information
         * @returns The download context
         */
        'download': function (downloadContext) {
            LOG.info('RGet > Download started : GET %s (FTP) TO %s (FS)', downloadContext.source, downloadContext.destination);
            downloadContext.initialized();
            startDownload(downloadContext);
            return downloadContext;
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
