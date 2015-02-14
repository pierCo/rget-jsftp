var events = require('events');
var path = require('path');
var util = require('util');

var FileToDownload = function () {
    "use strict";
    this.name = '';
    this.relativePath = '';
    this.size = 0;
    this.complete = 0;
};

FileToDownload.prototype.isComplete = function () {
    "use strict";
    return this.complete >= this.size;
};

var FolderToDownload = function () {
    "use strict";
    this.name = '';
    this.relativePath = '';
    this.explored = false;
};

var DownloadContext = function (source, destination) {
    "use strict";
    this.files = [];
    this.folders = [];
    this.source = source;
    this.destination = destination;
};


DownloadContext.prototype.constructor = DownloadContext;
util.inherits(DownloadContext, events.EventEmitter);

DownloadContext.prototype.initialized = function () {
    "use strict";
    this.files = [];
    this.folders = [];
};

DownloadContext.prototype.addFile = function (source, size) {
    "use strict";
    var file = new FileToDownload();
    file.name = path.basename(source);
    file.relativePath = path.relative(this.source, source);
    file.size = size;
    this.files.push(file);
    return file;
};

DownloadContext.prototype.addFolder = function (source) {
    "use strict";
    var folder = new FolderToDownload();
    folder.name = path.basename(source);
    folder.relativePath = path.relative(this.source, source);
    folder.explored = false;
    this.folders.push(folder);
    return folder;
};

DownloadContext.prototype.getTotalSize = function () {
    return this.files.reduce(function (total, file) {
        return total + file.size;
    }, 0);
};

DownloadContext.prototype.getDownloadedSize = function () {
    "use strict";
    return this.files.reduce(function (total, file) {
        return total + file.complete;
    }, 0);
};

DownloadContext.prototype.getNotDownloadedFiles = function () {
    "use strict";
    return this.files.filter(function (file) {
        return !file.isComplete();
    });
};

DownloadContext.prototype.getDownloadedFiles = function () {
    "use strict";
    return this.files.filter(function (file) {
        return file.isComplete();
    });
};

DownloadContext.prototype.getNotExploredFolders = function () {
    "use strict";
    return this.folders.filter(function (folder) {
        return !folder.explored;
    });
};

DownloadContext.prototype.getExploredFolders = function () {
    "use strict";
    return this.folders.filter(function (folder) {
        return folder.explored;
    });
};

DownloadContext.prototype.getFileSource = function (file) {
    "use strict";
    return path.join(this.source, file.relativePath);
};

DownloadContext.prototype.getFileDestination = function (file) {
    "use strict";
    if (file.relativePath === '') {
        return path.normalize(path.join(this.destination, file.name));
    } else {
        return path.normalize(path.join(this.destination, file.relativePath));
    }
};

DownloadContext.prototype.getFolderSource = function (folder) {
    "use strict";
    return path.join(this.source, folder.relativePath);
};

DownloadContext.prototype.getFolderDestination = function (folder) {
    "use strict";
    return path.normalize(path.join(this.destination, folder.relativePath));
};

DownloadContext.instantiate = function (source, destination) {
    "use strict";
    return new DownloadContext(source, destination);
};

module.exports = DownloadContext;