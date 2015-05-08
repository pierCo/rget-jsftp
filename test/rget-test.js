var assert = require("assert");
var ftpServerTest = require('ftp-test-server');
var rget = require('../lib/rget-jsftp');
var path = require('path');
var rimraf = require('rimraf');
var fs = require('fs');
var crc = require('crc');

"use strict";

describe('reget', function () {

    var ftpServer, rgetClient;

    var downloadDestination = path.join(process.cwd(), 'test', 'dest');

    before(function (done) {
        ftpServer = new ftpServerTest();
        ftpServer.init({
            host: '127.0.0.1',
            user: 'user',
            pass: '12345',
            port: 3334
        });
        setTimeout(function () {
            // wait during FTP server initialization
            done();
        }, 1500)
    });

    beforeEach(function (done) {
        rgetClient = rget.RGet({
            host: 'localhost',
            username: 'user',
            password: '12345',
            port: 3334
        });
        fs.mkdir(downloadDestination, function () {
            done();
        });
    });

    after(function (done) {
        if (typeof ftpServer !== 'undefined') {
            ftpServer.stop();
        }
        done();
    });

    afterEach(function (done) {
        rgetClient.destroy();
        rimraf(downloadDestination, function () {
            done();
        });
    });

    it('Initialized RGet with undefined params', function (next) {
        assert.throws(function () {
            rget.RGet();
        }, Error);
        next();
    });

    it('Initialized RGet with empty params', function (next) {
        assert.throws(function () {
            rget.RGet({});
        }, Error);
        next();
    });

    it('Bad host connection', function (next) {
        var rgetObj = rget.RGet({
            host: 'badhost.bad.very',
            username: 'user',
            password: '12345',
            port: 3334
        }, null);
        var ctx = rgetObj.generateDownloadContext('', '');
        ctx.on('error', function (err) {
            if (err.code === 'ENOTFOUND') {
                next();
            } else {
                assert.fail(err);
            }
        });
        rgetObj.download(ctx);
    });

    it('No such file or directory', function (next) {
        var srcNotExist = 'not_exist';
        var ctx = rgetClient.generateDownloadContext(srcNotExist, downloadDestination);
        ctx.on('error', function (err) {
            if (err.code === 550) {
                next();
            } else {
                assert.fail(err);
            }
        });
        ctx.on('initialized', function () {
            if (ctx.files.length > 1 || ctx.folders.length > 0 || ctx.source !== srcNotExist) {
                assert.fail();
            }
        });
        ctx.on('finished', function () {
            assert.fail();
        });
        rgetClient.download(ctx);
    });

    function testDownloadOneFile(fileSource, next) {
        var ctx = rgetClient.generateDownloadContext(fileSource, downloadDestination);
        ctx.on('error', function (err) {
            assert.fail(err);
        });
        ctx.on('errorWithFile', function (err) {
            assert.fail(err);
        });
        ctx.on('initialized', function (file) {
            if (ctx.files.length != 1 || ctx.folders.length > 0 || ctx.source !== fileSource) {
                assert.fail();
            }
        });
        ctx.on('fileAdded', function (file) {
            if (file.name !== path.basename(fileSource)) {
                assert.fail();
            }
        });
        ctx.on('downloadStart', function (file) {
            if (file.name !== path.basename(fileSource)) {
                assert.fail();
            }
        });
        ctx.on('downloadFinished', function (file) {
            if (file.name !== path.basename(fileSource)) {
                assert.fail();
            }
            assertFailIfDownloadedFileIsNotTheSameThatTheSource(this, file);
        });
        ctx.on('finished', function () {
            next();
        });
        rgetClient.download(ctx);
    }

    it('Download one file', function (next) {
        testDownloadOneFile('/test/server/1/my_file.txt', next);
    });

    function copyFileAndRunTest(source, destination, callback) {
        var readable = fs.createReadStream(source);
        readable.pipe(fs.createWriteStream(destination));
        readable.on('end', function () {
            callback();
        });
    }

    it('Download one file present in destination folder', function (next) {
        var fileSource = path.join(process.cwd(), '/test/server/1/my_file.txt');
        var fileDestination = path.join(downloadDestination, 'my_file.txt');
        copyFileAndRunTest(fileSource, fileDestination, function () {
            testDownloadOneFile('/test/server/1/my_file.txt', next);
        });
    });

    it('Download one file presents and corrupts in destination folder', function (next) {
        var fileSource = path.join(process.cwd(), '/test/server/1/bad_file.txt');
        var fileDestination = path.join(downloadDestination, 'my_file.txt');
        var readable = fs.createReadStream(fileSource);
        copyFileAndRunTest(fileSource, fileDestination, function () {
            testDownloadOneFile('/test/server/1/my_file.txt', next);
        });
    });

    it('Download one file with the same name of its parent folder', function (next) {
        testDownloadOneFile('/test/server/1/1', next);
    });

    it('Download one folder', function (next) {
        var fileSource = '/test/server/2';
        var ctx = rgetClient.generateDownloadContext(fileSource, downloadDestination);
        ctx.on('error', function (err) {
            assert.fail(err);
        });
        ctx.on('errorWithFile', function (err) {
            assert.fail(err);
        });
        ctx.on('initialized', function (file) {
            if (ctx.files.length != 4 || ctx.folders.length != 3) {
                assert.fail();
            }
        });
        ctx.on('downloadFinished', function (file) {
            assertFailIfDownloadedFileIsNotTheSameThatTheSource(this, file);
        });
        ctx.on('finished', function () {
            next();
        });
        rgetClient.download(ctx);
    });

    it('Download one folder and prefix all files names with XXX_', function (next) {
        var fileSource = '/test/server/2';
        var ctx = rgetClient.generateDownloadContext(fileSource, function (relativePath, type) {
            if (type === 'file') {
                var filename = 'XXX_' + path.basename(relativePath);
                var dir = path.dirname(relativePath);
                return path.normalize(path.join(downloadDestination, dir, filename));
            } else {
                return path.normalize(path.join(downloadDestination, relativePath));
            }
        });
        ctx.on('error', function (err) {
            assert.fail(err);
        });
        ctx.on('errorWithFile', function (err) {
            assert.fail(err);
        });
        ctx.on('initialized', function (file) {
            if (ctx.files.length != 4 || ctx.folders.length != 3) {
                assert.fail();
            }
        });
        ctx.on('downloadFinished', function (file) {
            var to = ctx.getFileDestinationPath(file);
            if (path.basename(to).indexOf('XXX_') > 0) {
                assert.fail('Not prefixed');
            }
            assertFailIfDownloadedFileIsNotTheSameThatTheSource(this, file);
        });
        ctx.on('finished', function () {
            next();
        });
        rgetClient.download(ctx);
    });

    it('Download one folder with one file and it have the same name', function (next) {
        var fileSource = '/test/server/3';
        var ctx = rgetClient.generateDownloadContext(fileSource, downloadDestination);
        ctx.on('error', function (err) {
            assert.fail(err);
        });
        ctx.on('errorWithFile', function (err) {
            assert.fail(err);
        });
        ctx.on('initialized', function (file) {
            if (ctx.files.length != 1 || ctx.folders.length != 1) {
                assert.fail();
            }
        });
        ctx.on('downloadFinished', function (file) {
            assertFailIfDownloadedFileIsNotTheSameThatTheSource(this, file);
        });
        ctx.on('finished', function () {
            next();
        });
        rgetClient.download(ctx);
    });

    function assertFailIfDownloadedFileIsNotTheSameThatTheSource(ctx, file) {
        var to = ctx.getFileDestinationPath(file);
        var from = path.join(process.cwd(), ctx.getFileSourcePath(file));
        var crc32To = crc.crc32(fs.readFileSync(to)).toString(16);
        var crc32From = crc.crc32(fs.readFileSync(from)).toString(16);
        if (crc32To !== crc32From) {
            assert.fail();
        }
    }

})
;