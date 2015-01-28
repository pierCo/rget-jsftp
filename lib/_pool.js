var poolModule = require('generic-pool');
var JsFtp = require("jsftp");
var helper = require('./_helper');

var FTPPool = function (params, logger) {
    "use strict";

    if (typeof params === 'undefined') {
        throw new Error('No parameters defined.');
    }

    var LOG = helper.logger(logger);

    var connectionData = helper.createAndMergeDefaultObjectAndData(FTPPool.DEFAULT_PARAM, params);
    if (typeof connectionData.host === 'undefined' || connectionData.host === '') {
        throw new Error('No host defined in parameters.');
    }

    function createFtpConnection(callback) {
        "use strict";
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
            LOG.info('FTP > Connect with username : %s', connectionData.username);
            ftp.auth(connectionData.username, connectionData.password, function () {
                callback(err, ftp);
            });
        }
    }

    function destroyFtpConnection(ftp) {
        "use strict";
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
        name: connectionData.name,
        create: createFtpConnection,
        destroy: destroyFtpConnection,
        max: connectionData.maxConnections,
        idleTimeoutMillis: connectionData.idleTimeoutMillis,
        log: false
    });

};

module.exports.Pool = FTPPool;

FTPPool.DEFAULT_PARAM = {
    'name': 'FTP_POOL',
    'host': '',
    'port': 21,
    'username': '',
    'password': '',
    "maxConnections": 4,
    'idleTimeoutMillis': 180000
};
