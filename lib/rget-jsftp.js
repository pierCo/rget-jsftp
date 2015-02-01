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
    var longFtpPool = new FTPPool.Pool('longFtpPool', rgetParams, rgetParams.maxShortConnections, rgetParams.idleLongConnection, logger);

    /**
     * Explore FTP source (defined in downloadContext) and download all files (and folder) it contains.
     * @param downloadContext All information about download. This object is update during the download actions.
     * @param folder folder contained in the FTP source.
     */
    function exploreAndDownloadFiles(downloadContext, folder) {
        "use strict";
        var source = downloadContext.source;
        if (typeof folder !== 'undefined') {
            source = downloadContext.getFolderSource(folder);
            LOG.info('RGet > Folder : %s', source);
        }
        Helper.ftpCmd('ls', shortFtpPool, source, function (err, files) {
            if (typeof err !== 'undefined' && err != null) {
                downloadContext.emit('error', err);
                return;
            }
            files.forEach(function (file) {
                var fileSource = path.join(source, file.name);
                if (file.type === 1) {
                    // folder
                    var folderToDownload = downloadContext.addFolder(fileSource);
                    downloadContext.emit('folderAdded', folderToDownload);
                    exploreAndDownloadFiles(downloadContext, folderToDownload);
                } else {
                    // file
                    LOG.info('RGet > File added to download list : %s', fileSource);
                    var fileToDownload = downloadContext.addFile(fileSource, file.size);
                    downloadContext.emit('fileAdded', fileToDownload);
                    downloadFile(downloadContext, fileToDownload);
                }
            });
            if (typeof folder !== 'undefined') {
                LOG.info('RGet > Folder explored : %s', source);
                folder.explored = true;
                downloadContext.emit('folderExplored', folder);
            }
            if (downloadContext.getNotExploredFolders() == 0) {
                downloadContext.emit('initialized');
            }
        });
    }

    function downloadFile(downloadContext, file) {
        "use strict";
        var destination = downloadContext.getFileDestination(file);
        var source = downloadContext.getFileSource(file);
        if (fs.existsSync(destination)) {
            var stats = fs.statSync(destination);
            var fsFileSize = stats.size;
            if (fsFileSize == file.size) {
                file.complete = fsFileSize;
                LOG.info('RGet > Already downloaded : %s', destination);
                finishDownload(downloadContext, file);
            } else {
                LOG.info('RGet > Exists : %s', destination);
                fs.unlinkSync(destination);
                createAndDownloadFile(downloadContext, file);
            }
        } else {
            if (!fs.existsSync(path.dirname(destination))) {
                fs.mkdirSync(path.dirname(destination));
            }
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
        var destination = downloadContext.getFileDestination(file);
        var source = downloadContext.getFileSource(file);
        longFtpPool.acquire(function (err, ftp) {
            if (err) {
                downloadContext.emit('error', err);
            } else {
                downloadContext.emit('downloadStart', file);
                ftp.get(source, function (err, socket) {
                    if (err) {
                        downloadContext.emit('errorWithFile', err, file);
                    } else {
                        LOG.info('RGet > Download started : %s', destination);
                        var lastDataEventLength = 0;
                        socket.on('data', function (data) {
                            fs.appendFile(destination, data, function () {
                                file.complete += data.length;
                                lastDataEventLength += data.length;
                                if (lastDataEventLength > rgetParams.stepDataEvent) {
                                    LOG.debug('RGet > Data received : %s (%d bytes on %d bytes)', destination, file.complete, file.size);
                                    lastDataEventLength = 0;
                                    downloadContext.emit('dataReceived', file);
                                }
                            });
                        });
                        socket.on('close', function (err) {
                            longFtpPool.release(ftp);
                            if (err) {
                                downloadContext.emit('errorDownload', err, file);
                            } else {
                                finishDownload(downloadContext, file);
                            }
                        });
                        socket.resume();
                    }
                });
            }
        });
    }

    function finishDownload(downloadContext, file) {
        "use strict";
        if (file.isComplete()) {
            LOG.info('RGet > Download finished : %s', downloadContext.getFileDestination(file));
            downloadContext.emit('downloadFinished', file);
            if (downloadContext.getNotDownloadedFiles().length === 0) {
                downloadContext.emit('finished');
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
            exploreAndDownloadFiles(downloadContexte);
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