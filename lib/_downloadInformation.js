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

var DownloadInformation = function (source, destination) {
    "use strict";
    this.files = [];
    this.folders = [];
    this.source = source;
    this.destination = destination;
};


DownloadInformation.prototype.constructor = DownloadInformation;
util.inherits(DownloadInformation, events.EventEmitter);

DownloadInformation.prototype.addFile = function (source, size) {
    "use strict";
    var file = new FileToDownload();
    file.name = path.basename(source);
    file.relativePath = path.relative(this.source, source);
    file.size = size;
    this.files.push(file);
    return file;
};

DownloadInformation.prototype.addFolder = function (source) {
    "use strict";
    var folder = new FolderToDownload();
    folder.name = path.basename(source);
    folder.relativePath = path.relative(this.source, source);
    folder.explored = false;
    this.folders.push(folder);
    return folder;
};

DownloadInformation.prototype.getTotalSize = function () {
    return this.files.reduce(function (total, file) {
        return total + file.size;
    }, 0);
};

DownloadInformation.prototype.getDownloadedSize = function () {
    "use strict";
    return this.files.reduce(function (total, file) {
        return total + file.complete;
    }, 0);
};

DownloadInformation.prototype.getNotDownloadedFiles = function () {
    "use strict";
    return this.files.filter(function (file) {
        return !file.isComplete();
    });
};

DownloadInformation.prototype.getDownloadedFiles = function () {
    "use strict";
    return this.files.filter(function (file) {
        return file.isComplete();
    });
};

DownloadInformation.prototype.getNotExploredFolders = function () {
    "use strict";
    return this.folders.filter(function (folder) {
        return !folder.explored;
    });
};

DownloadInformation.prototype.getExploredFolders = function () {
    "use strict";
    return this.folders.filter(function (folder) {
        return folder.explored;
    });
};

DownloadInformation.prototype.getFileSource = function (file) {
    "use strict";
    return path.join(this.source, file.relativePath);
};

DownloadInformation.prototype.getFileDestination = function (file) {
    "use strict";
    return path.normalize(path.join(this.destination, file.relativePath === '' ? file.name : file.relativePath));
};

DownloadInformation.prototype.getFolderSource = function (folder) {
    "use strict";
    return path.join(this.source, folder.relativePath);
};

DownloadInformation.prototype.getFolderDestination = function (folder) {
    "use strict";
    return path.normalize(path.join(this.destination, folder.relativePath));
};

DownloadInformation.instantiate = function (source, destination) {
    "use strict";
    return new DownloadInformation(source, destination);
};

module.exports = DownloadInformation;