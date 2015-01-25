var fs = require('fs');
var path = require('path');
var FTPPool = require('./_pool');
var Helper = require('./_helper');
var DownloadInformation = require('./_downloadInformation');

var RGet = function (params, logger) {
    "use strict";

    if (typeof params === 'undefined') {
        throw new Error('No parameters defined.');
    }

    var LOG = Helper.logger(logger);

    var paramsShortConnection = getPoolParameters('maxShortConnections');
    var shortFtpPool = FTPPool.Pool(paramsShortConnection, logger);

    var paramsLongConnection = getPoolParameters('maxLongConnections');
    var longFtpPool = new FTPPool.Pool(paramsLongConnection, logger);

    function getPoolParameters(maxConnectionsParamName) {
        "use strict";
        var paramsPool = params;
        if (typeof params[maxConnectionsParamName] !== 'undefined') {
            paramsPool = Helper.createAndMergeDefaultObjectAndData(params, params);
            paramsPool.maxConnections = [maxConnectionsParamName];
        }
        return paramsPool;
    }

    var rgetParams = Helper.createAndMergeDefaultObjectAndData(RGet.DEFAULT_PARAM, params);

    /**
     * Explore FTP source (defined in downloadInformation) and download all files (and folder) it contains.
     * @param downloadInformation All information about download. This object is update during the download actions.
     * @param folder folder contained in the FTP source.
     */
    function exploreAndDownloadFiles(downloadInformation, folder) {
        "use strict";
        var source = downloadInformation.source;
        if (typeof folder !== 'undefined') {
            source = downloadInformation.getFolderSource(folder);
            LOG.info('RGet > Folder : %s', source);
        }
        Helper.ftpCmd('ls', shortFtpPool, source, function (err, files) {
            if (typeof err !== 'undefined' && err != null) {
                downloadInformation.emit('error', err);
                return;
            }
            files.forEach(function (file) {
                var fileSource = path.join(source, file.name);
                if (file.type === 1) {
                    // folder
                    var folderToDownload = downloadInformation.addFolder(fileSource);
                    downloadInformation.emit('folderAdded', folderToDownload);
                    exploreAndDownloadFiles(downloadInformation, folderToDownload);
                } else {
                    // file
                    LOG.info('RGet > File added to download list : %s', fileSource);
                    var fileToDownload = downloadInformation.addFile(fileSource, file.size);
                    downloadInformation.emit('fileAdded', fileToDownload);
                    downloadFile(downloadInformation, fileToDownload);
                }
            });
            if (typeof folder !== 'undefined') {
                LOG.info('RGet > Folder explored : %s', source);
                folder.explored = true;
                downloadInformation.emit('folderExplored', folder);
            }
            if (downloadInformation.getNotExploredFolders() == 0) {
                downloadInformation.emit('initialized');
            }
        });
    }

    function downloadFile(downloadInformation, file) {
        "use strict";
        var destination = downloadInformation.getFileDestination(file);
        var source = downloadInformation.getFileSource(file);
        if (fs.existsSync(destination)) {
            var stats = fs.statSync(destination);
            var fsFileSize = stats.size;
            if (fsFileSize == file.size) {
                file.complete = fsFileSize;
                LOG.info('RGet > Already downloaded : %s', destination);
                finishDownload(downloadInformation, file);
            } else {
                LOG.info('RGet > Exists : %s', destination);
                fs.unlinkSync(destination);
                createAndDownloadFile(downloadInformation, file);
            }
        } else {
            if (!fs.existsSync(path.dirname(destination))) {
                fs.mkdirSync(path.dirname(destination));
            }
            createAndDownloadFile(downloadInformation, file);
        }
    }

    /**
     * This function creates the file and its folders (if the file is into a folder on the FTP) on your filesystem and write its data contained in the FTP.
     * @param downloadInformation All information about download. This object is updated during the download actions.
     * @param file the file to download
     */
    function createAndDownloadFile(downloadInformation, file) {
        "use strict";
        var destination = downloadInformation.getFileDestination(file);
        var source = downloadInformation.getFileSource(file);
        longFtpPool.acquire(function (err, ftp) {
            if (err) {
                downloadInformation.emit('error', err);
            } else {
                downloadInformation.emit('downloadStart', file);
                ftp.get(source, function (err, socket) {
                    if (err) {
                        downloadInformation.emit('errorFile', err, file);
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
                                    downloadInformation.emit('dataReceived', file);
                                }
                            });
                        });
                        socket.on('close', function (err) {
                            longFtpPool.release(ftp);
                            if (err) {
                                downloadInformation.emit('errorDownload', err, file);
                            } else {
                                finishDownload(downloadInformation, file);
                            }
                        });
                        socket.resume();
                    }
                });
            }
        });
    }

    function finishDownload(downloadInformation, file) {
        "use strict";
        if (file.isComplete()) {
            LOG.info('RGet > Download finished : %s', downloadInformation.getFileDestination(file));
            downloadInformation.emit('downloadFinished', file);
            if (downloadInformation.getNotDownloadedFiles().length === 0) {
                downloadInformation.emit('finished');
            }
        }
    }


    return {
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
         *  - errorFile
         */
        'download': function (source, destination) {
            LOG.info('RGet > Download started : GET %s (FTP) TO %s (FS)', source, destination);
            var downloadInformation = DownloadInformation.instantiate(source, destination);
            exploreAndDownloadFiles(downloadInformation);
            return downloadInformation;
        },
        'destroy': function () {
            shortFtpPool.destroy();
            longFtpPool.destroy();
        }
    }

};

module.exports.RGet = RGet;

RGet.DEFAULT_PARAM = {
    stepDataEvent: 5000000
};