module.exports = {

    'mapObjectProperties': function (source, destination) {
        Object.keys(destination).forEach(function (key) {
            if (source.hasOwnProperty(key)) {
                this[key] = source[key];
            }
        }, destination);
    },
    'logger': function (logger) {
        "use strict";
        var LOG = typeof logger !== 'undefined' ? logger : {
            info: console.info,
            log: console.log,
            debug: console.log
        };
        return LOG;
    }

};
