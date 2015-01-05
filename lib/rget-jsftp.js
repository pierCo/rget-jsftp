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

    function exploreFTP(downloadInformation, folderComplement) {
        "use strict";
        var sourceComplement = '';
        if (typeof folderComplement !== 'undefined') {
            sourceComplement = folderComplement.path;
        }
        var source = path.join(downloadInformation.source, sourceComplement);
        shortFtpPool.acquire(function (err, ftp) {
            if (err) {
                downloadInformation.emit('error', err);
            } else {
                ftp.ls(source, function (err, files) {
                    shortFtpPool.release(ftp);
                    if (err) {
                        downloadInformation.emit('error', err);
                    } else {
                        LOG.info('RGet > Folder : %s', source);
                        files.forEach(function (file) {
                            var filePath = path.join(sourceComplement, file.name);
                            if (file.type === 1) {
                                // folder
                                var folder = downloadInformation.addFolder(filePath);
                                downloadInformation.emit('folderAdded', folder);
                                exploreFTP(downloadInformation, folder);
                            } else {
                                // file
                                LOG.info('RGet > File added to download list : %s', filePath);
                                var fileToDownload = downloadInformation.addFile(filePath, file.size);
                                downloadInformation.emit('fileAdded', fileToDownload);
                                downloadFile(downloadInformation, fileToDownload);
                            }
                        });
                        LOG.info('RGet > Folder explored : %s', source);
                        if (typeof folderComplement !== 'undefined') {
                            folderComplement.explored = true;
                            downloadInformation.emit('folderExplored', folderComplement);
                            if (downloadInformation.getNotExploredFolders() === 0) {
                                downloadInformation.emit('initialized', folderComplement);
                            }
                        }
                    }
                });
            }
        });
    }

    function downloadFile(downloadInformation, file) {
        "use strict";
        var destination = path.normalize(path.join(downloadInformation.destination, file.path));
        var source = path.join(downloadInformation.source, file.path);
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

    function createAndDownloadFile(downloadInformation, file) {
        "use strict";
        var destination = downloadInformation.getFileDestination(file);
        var source = downloadInformation.getFileSource(file);
        longFtpPool.acquire(function (err, ftp) {
            if (err) {
                downloadInformation.emit('error', err);
            } else {
                downloadInformation.emit('fileStarted', file);
                ftp.get(source, function (err, socket) {
                    if (err) {
                        downloadInformation.emit('errorFile', err, file);
                    } else {
                        LOG.info('RGet > Download started : %s', destination);
                        var lastDataEventSize = 0;
                        socket.on('data', function (data) {
                            file.complete += data.length;
                            lastDataEventSize += data.length;
                            fs.appendFile(destination, data, function () {
                                if (lastDataEventSize > rgetParams.stepDataEvent) {
                                    LOG.debug('RGet > Data received : %s (%d bytes on %d bytes)', destination, file.complete, file.size);
                                    lastDataEventSize = 0;
                                    downloadInformation.emit('dataReceived', file);
                                }
                            });
                        });
                        socket.on('close', function (err) {
                            longFtpPool.release(ftp);
                            if (err) {
                                downloadInformation.emit('errorFile', err, file);
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
            downloadInformation.emit('fileFinished', file);
            if (downloadInformation.getNotDownloadedFiles().length === 0) {
                downloadInformation.emit('finished');
            }
        }
    }


    return {
        'download': function (source, destination) {
            LOG.info('RGet > Download started : GET %s (FTP) TO %s (FS)', source, destination);
            var downloadInformation = DownloadInformation.instantiate(source, destination);
            exploreFTP(downloadInformation);
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