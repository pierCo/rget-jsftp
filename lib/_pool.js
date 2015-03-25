var poolModule = require('generic-pool');
var JsFtp = require("jsftp");
var helper = require('./_helper');

"use strict";

var FTPPool = function (name, connectionData, maxConnections, idleTimeoutMillis, logger) {

    if (typeof connectionData === 'undefined') {
        throw new Error('No FTP parameters defined.');
    }

    var LOG = helper.logger(logger);

    if (typeof connectionData.host === 'undefined' || connectionData.host === '') {
        throw new Error('No host defined in parameters.');
    }

    function createFtpConnection(callback) {
        var ftp, err;
        try {
            ftp = new JsFtp({
                host: connectionData.host,
                port: connectionData.port
            });
            ftp.on('error', callback);
            LOG.info('FTP > Connect to : %s:%d', connectionData.host, connectionData.port);
        } catch (e) {
            err = e;
        }
        if (err) {
            callback(err, ftp);
        } else {
            LOG.info('FTP > Connect with username : %s', connectionData.username);
            ftp.auth(connectionData.username, connectionData.password, function (err) {
                callback(err, ftp);
            });
        }
    }

    function destroyFtpConnection(ftp) {
        if (typeof ftp !== 'undefined') {
            ftp.raw.quit(function (err) {
                if (err) {
                    LOG.error(err);
                }
                LOG.info('FTP > Disconnected');
            });
        }
    }

    return poolModule.Pool({
        name: name,
        create: createFtpConnection,
        destroy: destroyFtpConnection,
        max: maxConnections,
        idleTimeoutMillis: idleTimeoutMillis,
        log: false
    });

};

module.exports.Pool = FTPPool;
