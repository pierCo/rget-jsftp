var events = require('events');
var path = require('path');
var util = require('util');

var ftpFileDescription = module.exports = function () {
    this.source = '';
    this.destination = '';
    this.name = '';
    this.type = '';
    this.size = 0;
    this.complete = 0;
    this.children = [];
    this.parent = null;
};

util.inherits(ftpFileDescription, events.EventEmitter);

ftpFileDescription.types = {
    FILE: 'file',
    FOLDER: 'folder'
};

ftpFileDescription.prototype.addChild = function (download) {
    download.parent = this;
    this.children.push(download);
};

ftpFileDescription.prototype.isComplete = function () {
    return this.size === this.complete;
};

ftpFileDescription.prototype.isFolder = function () {
    return this.type === ftpFileDescription.types.FOLDER;
};

ftpFileDescription.prototype.isFile = function () {
    return this.type === ftpFileDescription.types.FILE;
};

ftpFileDescription.prototype.getTotalSize = function () {
    return this.children.reduce(function (total, subfile) {
        return total + subfile.getTotalSize();
    }, this.size);
};

ftpFileDescription.prototype.getTotalComplete = function () {
    return this.children.reduce(function (total, subfile) {
        return total + subfile.getTotalComplete();
    }, this.complete);
};

ftpFileDescription.prototype.getSubFolders = function () {
    return this.children.reduce(function (subDownload) {
        return subDownload.isFolder();
    });
};

ftpFileDescription.prototype.getSubFiles = function () {
    return this.children.reduce(function (subDownload) {
        return subDownload.isFile();
    });
};

ftpFileDescription.prototype.getCompleteSourcePath = function () {
    return path.join(this.source, this.name);
};

ftpFileDescription.prototype.getCompleteDestinationPath = function () {
    return path.join(this.destination, this.name);
};

ftpFileDescription.instantiate = function () {
    return new ftpFileDescription();
}