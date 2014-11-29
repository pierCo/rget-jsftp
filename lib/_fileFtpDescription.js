var events = require('events');
var path = require('path');

module.exports = (function () {

    "use strict";

    function ftpFileDescription() {
        this.source = '';
        this.destination = '';
        this.name = '';
        this.type = '';
        this.size = 0;
        this.complete = 0;
        this.children = [];
        this.parent = null;
    }

    ftpFileDescription.types = {
        FILE: 'file',
        FOLDER: 'folder'
    };

    ftpFileDescription.prototype.__proto__ = events.EventEmitter.prototype;

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
        var totalSize = this.children.reduce(function (total, subfile) {
            return total + subfile.getTotalSize();
        }, this.size);
        return totalSize;
    };

    ftpFileDescription.prototype.getTotalComplete = function () {
        var totalSize = this.children.reduce(function (total, subfile) {
            return total + subfile.getTotalComplete();
        }, this.complete);
        return totalSize;
    };

    ftpFileDescription.prototype.getSubFolders = function () {
        var subFiles = this.children.reduce(function (subDownload) {
            return subDownload.isFolder();
        });
        return subFiles;
    };

    ftpFileDescription.prototype.getSubFiles = function () {
        var subFolder = this.children.reduce(function (subDownload) {
            return subDownload.isFile();
        });
        return subFolder;
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

    return ftpFileDescription;

})();