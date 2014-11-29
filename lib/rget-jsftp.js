var fs = require('fs');
var path = require('path');
var pool = require('./_pool');
var helper = require('./_helper');
var fileFtpDescription = require('./_fileFtpDescription');

module.exports = function (params, logger) {

    "use strict";

    var LOG = helper.logger(logger);

    if (typeof params === 'undefined') {
        throw new Error('No parameters defined.');
    }

    var FtpConnectionPool = pool(params, logger);

    var rgetParamsDefault = {
        stepForEmitDataEvent: 100000
    };

    var rgetParams = helper.createAndMergeDefaultObjectAndData(rgetParamsDefault, params);

    function createDownloadDescription(source, destination) {
        var root = fileFtpDescription.instantiate();
        FtpConnectionPool.shortFtpPool.acquire(function (err, ftp) {
            LOG.info('FTP > Construct download description for %s (FTP) to %s (FS)', source, destination);
            ftp.ls(source, function (err, files) {
                FtpConnectionPool.shortFtpPool.release(ftp);
                if (err) {
                    throw err;
                }
                var pathSplit = source.split(path.sep).filter(function (el) {
                    return el.length > 0;
                });
                if (pathSplit.length > 0) {
                    root.name = pathSplit[pathSplit.length - 1];
                }
                pathSplit.splice(pathSplit.length - 1, 1);
                root.source = path.sep + pathSplit.join(path.sep);
                root.destination = path.normalize(destination);
                if (files.length === 1) {
                    var file = files[0];
                    if (file.name === source) {
                        root.type = fileFtpDescription.types.FILE;
                        root.size = parseInt(file.size);
                    } else {
                        root.type = fileFtpDescription.types.FOLDER;
                    }
                } else {
                    root.type = fileFtpDescription.types.FOLDER;
                }
                LOG.info('FTP > Root download description information : %s ', root);
                if (root.isFolder()) {
                    browseFTP(root);
                } else {
                    root.emit('initialized');
                }
            });
        });
        return root;
    }

    function browseFTP(parentDesc) {
        var parentCompletePath = parentDesc.getCompleteSourcePath();
        FtpConnectionPool.shortFtpPool.acquire(function (err, ftp) {
            if (err) {
                throw err;
            }
            ftp.ls(parentCompletePath, function (err, files) {
                FtpConnectionPool.shortFtpPool.release(ftp);
                if (err) {
                    throw err;
                }

                var nbFolder = files.filter(function (file) {
                    return file.type === 1;
                }).length;
                var folderCounter = 0;
                files.forEach(function (file) {
                    var childDesc = fileFtpDescription.instantiate();
                    parentDesc.addChild(childDesc);
                    childDesc.name = path.basename(file.name);
                    childDesc.source = parentCompletePath;
                    childDesc.destination = parentDesc.getCompleteDestinationPath();
                    if (file.type === 1) {
                        childDesc.type = fileFtpDescription.types.FOLDER;
                        childDesc.on('initialized', function () {
                            folderCounter++;
                            if (nbFolder === folderCounter) {
                                parentDesc.emit('initialized');
                            }
                        });
                        LOG.debug('FTP > Add folder description with ftp path : %s/%s', childDesc.source, childDesc.name);
                        browseFTP(childDesc);
                    } else {
                        childDesc.type = fileFtpDescription.types.FILE;
                        childDesc.size = parseInt(file.size);
                        LOG.debug('FTP > Add file description with ftp path : %s/%s (%d bytes)', childDesc.source, childDesc.name, childDesc.size);
                    }
                });

                if (nbFolder === 0) {
                    parentDesc.emit('initialized');
                }
            });
        });
    }

    function download(downloadDesc) {
        if (downloadDesc.isFolder()) {
            downloadFolder(downloadDesc);
        } else {
            downloadFile(downloadDesc);
        }
    }

    function downloadFile(downloadDesc) {
        var source = downloadDesc.getCompleteSourcePath();
        var destination = downloadDesc.getCompleteDestinationPath();
        LOG.info('FTP > Download %s to %s', source, destination);
        if (fs.existsSync(destination)) {
            var stats = fs.statSync(destination);
            var fsFileSize = stats.size;
            if (fsFileSize === downloadDesc.size) {
                LOG.debug('FTP > File %s exists on the FS : finish', destination);
                downloadDesc.complete = fsFileSize;
                downloadDesc.emit('finished');
            } else {
                LOG.debug('FTP > File %s exists on the FS but incomplete : delete and download', destination);
                fs.unlinkSync(destination);
                createAndGetFile(downloadDesc);
            }
        } else {
            LOG.debug('FTP > File %s not on the FS : download', destination);
            createAndGetFile(downloadDesc);
        }

    }

    function createAndGetFile(downloadDesc) {
        var source = downloadDesc.getCompleteSourcePath();
        var destination = downloadDesc.getCompleteDestinationPath();
        FtpConnectionPool.longFtpPool.acquire(function (err, ftp) {
            if (err) {
                throw err;
            }
            ftp.get(source, function (err, socket) {
                if (err) {
                    throw err;
                }
                LOG.debug('FTP > File %s in download', destination);
                var lastDataEventSize = 0;
                socket.on('data', function (data) {
                    fs.appendFile(destination, data, function () {
                        downloadDesc.complete += data.length;
                        lastDataEventSize += data.length;
                        if (lastDataEventSize > rgetParams.stepForEmitDataEvent) {
                            LOG.debug('FTP > Receive data : %s (%d bytes on %d bytes)', destination, downloadDesc.complete, downloadDesc.size);
                            lastDataEventSize = 0;
                            downloadDesc.emit('data');
                        }
                    });
                });

                socket.on('close', function (err) {
                    FtpConnectionPool.longFtpPool.release(ftp);
                    if (err) {
                        throw err;
                    }
                    if (downloadDesc.isComplete()) {
                        LOG.info('FTP > File %s downloaded', destination);
                        downloadDesc.emit('finished');
                    }
                });

                socket.resume();

            });
        });
    }

    function downloadFolder(downloadDesc) {
        var destination = downloadDesc.getCompleteDestinationPath();
        fs.mkdir(destination, function () {
            downloadDesc.children.forEach(function (subDownloadDesc) {
                download(subDownloadDesc);
                subDownloadDesc.on('data', function () {
                    downloadDesc.emit('data');
                });
            });
        });
    }

    return {

        download: function (source, destination) {
            var downloadDesc = createDownloadDescription(source, destination);
            downloadDesc.on('initialized', function () {
                download(downloadDesc);
            });
            return downloadDesc;
        }

    };

};