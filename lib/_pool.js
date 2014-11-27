var poolModule = require('generic-pool');
var JsFtp = require("jsftp");
var helper = require('./_helper');

module.exports = function (params, logger) {

    "use strict";

    var LOG = helper.logger(logger);

    if (typeof params === 'undefined') {
        throw new Error('No parameters defined.');
    }

    var connectionDataDefault = {
        'host': '',
        'port': 21,
        'username': '',
        'password': '',
        'anonymous': false,
        'maxLongConnection': 4,
        'maxShortConnection': 2,
        'idleTimeoutMillis': 180000
    }

    var connectionData = helper.createAndMergeDefaultObjectAndData(connectionDataDefault, params);

    if (typeof connectionData.host === 'undefined') {
        throw new Error('No host defined in parameters.');
    }

    function createFtpConnection(callback) {
        var ftp, err;
        try {
            ftp = new JsFtp({
                host: connectionData.host,
                port: connectionData.port
            });
            LOG.info('FTP > Connect to : %s:%d', connectionData.host, connectionData.port);
        } catch (e) {
            err = e;
        }
        if (err) {
            callback(err, ftp);
        } else {
            if (connectionData.anonymous) {
                LOG.info('FTP > Anonymous connection');
                ftp.auth(function () {
                    callback(err, ftp);
                });
            } else {
                LOG.info('FTP > Connect with username : %s', connectionData.username);
                ftp.auth(connectionData.username, connectionData.password, function () {
                    callback(err, ftp);
                });
            }
        }
    }

    function destroyFtpConnection(ftp) {
        ftp.raw.quit(function (err) {
            if (err) {
                LOG.error(err);
            }
            LOG.info('FTP > Disconnected !!!');
        });
    }

    return {
        longFtpPool: poolModule.Pool({
            name: 'FTP_POOL__LONG',
            create: createFtpConnection,
            destroy: destroyFtpConnection,
            max: connectionData.maxLongConnection,
            idleTimeoutMillis: connectionData.idleTimeoutMillis,
            log: false
        }),
        shortFtpPool: poolModule.Pool({
            name: 'FTP_POOL__SHORT',
            create: createFtpConnection,
            destroy: destroyFtpConnection,
            max: connectionData.maxShortConnection,
            idleTimeoutMillis: connectionData.idleTimeoutMillis,
            log: false
        })
    };

};