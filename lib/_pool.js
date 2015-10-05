var poolModule = require('generic-pool');
var JsFtp = require("jsftp");
var helper = require('./_helper');

"use strict";

var FTPPool = function (name, connectionData, maxConnections, idleTimeoutMillis, logger) {

    if (typeof connectionData === 'undefined') {
        throw new Error('No FTP (%s)parameters defined.', name);
    }

    var LOG = helper.logger(logger);

    if (typeof connectionData.host === 'undefined' || connectionData.host === '') {
        throw new Error('No host defined in parameters.');
    }

    function createFtpConnection(callback) {
        LOG.debug('Create FTP connection...');
        var ftp, err;
        try {
            ftp = new JsFtp({
                host: connectionData.host,
                port: connectionData.port
            });
            ftp.on('error', callback);
            LOG.info('FTP (%s) > Connect to : %s:%d', name, connectionData.host, connectionData.port);
        } catch (e) {
            err = e;
        }
        if (err) {
            callback(err, ftp);
        } else {
            LOG.info('FTP (%s) > Connect with username : %s', name, connectionData.username);
            ftp.auth(connectionData.username, connectionData.password, function (err) {
                callback(err, ftp);
            });
        }
    }

    function destroyFtpConnection(ftp) {
        LOG.debug('Destroy FTP connection...');
        if (typeof ftp !== 'undefined') {
            ftp.raw.quit(function (err) {
                if (err) {
                    LOG.error(err);
                }
                LOG.info('FTP (%s) > Disconnected', name);
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
