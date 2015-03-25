var fs = require('fs');
var path = require('path');

"use strict";

module.exports = {

    'createAndMergeDefaultObjectAndData': function (defaultObject, data) {
        var objectMerged = {};
        Object.keys(defaultObject).forEach(function (key) {
            if (data.hasOwnProperty(key)) {
                this[key] = data[key];
            } else {
                this[key] = defaultObject[key];
            }
        }, objectMerged);
        return objectMerged;
    },
    /**
     * Recursive MKDIR.
     *
     * @param dirPath
     */
    'rMkdir': function (dirPath) {
        if (!fs.existsSync(dirPath)) {
            var parentDirPath = path.dirname(dirPath);
            this.rMkdir(parentDirPath);
            fs.mkdirSync(dirPath);
        }
    },
    'defaultLogger': {
        'error': console.error,
        'info': console.info,
        'log': console.log,
        'debug': console.log
    },
    'emptyLogger': {
        'error': function () {
        },
        'info': function () {
        },
        'log': function () {
        },
        'debug': function () {
        }
    },
    'logger': function (logger) {
        if (typeof logger === 'undefined') {
            return this.defaultLogger;
        } else if (logger === null) {
            return this.emptyLogger;
        } else {
            return logger;
        }
    },
    'ftpCmd': function (cmd, pool /**/) {
        var cmdArgs = Array.prototype.slice.call(arguments, 2, arguments.length - 1);
        var callback = arguments[arguments.length - 1];
        pool.acquire(function (err, ftp) {
            if (err) {
                callback(err);
            } else {
                cmdArgs.push(function () {
                    pool.release(ftp);
                    callback.apply(this, arguments);
                });
                ftp[cmd].apply(ftp, cmdArgs);
            }
        });
    }
};
