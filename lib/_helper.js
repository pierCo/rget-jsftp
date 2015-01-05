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
            debug: console.trace
        };
        return LOG;
    }

};
