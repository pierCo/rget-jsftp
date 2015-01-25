module.exports = {

    'createAndMergeDefaultObjectAndData': function (defaultObject, data) {
        "use strict";
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
    'logger': function (logger) {
        "use strict";
        var LOG = typeof logger !== 'undefined' ? logger : {
            error: console.error,
            info: console.info,
            log: console.log,
            debug: console.log
        };
        return LOG;
    },
    "ftpCmd": function (cmd, pool /**/) {
        "use strict";
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
