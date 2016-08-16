RGET-JSFTP
=========
A client FTP module to download files or folders with a connection pool for manage the FTP access.
This nodeJS module uses :
- [jsftp](https://github.com/sergi/jsftp "Go to GitHub") to connect and to request the FTP server
- [node-pool](https://github.com/coopernurse/node-pool "Go to GitHub") to manage the FTP connections
** The only change from the original RGET-JSFTP module in the option to inject the DEBUG mode into the jsftp module **

How do you use it
=========
## Step 1 - Import module

```javascript
var rget = require('rget-jsftp');
```

## Step 2 - Instantiate "rget"
A rget client instance can connect to only one FTP server, if you want to connect to two servers you must instantiate two clients.

```javascript
ver rgetClient = rget.RGet({
    ... // params
});
```

All possible parameters are :

```javascript
{
    'stepDataEvent': 5000000,
    'maxShortConnections': 4,
    'maxLongConnections': 4,
    'idleShortConnection': 30000,
    'idleLongConnection': 30000,
    'host': '',
    'port': 21,
    'username': '',
    'password': '',
    'debug': false
}
```
| Parameter name      | Description      |
| ------------------- | ---------------- |
| stepDataEvent       | Indicate how often of data reception (in bytes) must be executed the event "dataReceived". _The default value is 5000000 bytes, ie 5 MBytes._ |
| maxShortConnections | Indicate how many short connections can be used in the same time. A short connection is used to browse the FTP server and to prepare the download files list. _The default value is 4._ |
| maxLongConnections  | Indicate how many long connections can be used in the same time. A long connection is used to download file. _The default value is 4._ |
| idleShortConnection | Indicate how many time (in millisecond) an inactive connection stays in the short pool. _The default value is 30000ms whether 30 seconds._ |
| idleLongConnection  | Indicate how many time (in millisecond) an inactive connection stays in the long pool. _The default value is 30000ms, ie 30 seconds._ |
| host                | The FTP connection host. This value is mandatory. |
| port                | The FTP connection port. _The default value is 21._ |
| username            | The user name for the protected FTP connection. _If the value is empty the FTP connection will be anonymous._ |
| password            | The user password for the protected FTP connection. |

## Step 3 - Create the download context
```javascript
var ctx = rgetClient.generateDownloadContext('from', 'to');
// OR
var ctx = rgetClient.generateDownloadContext('from', function(relativeFtpPath, type, object){
    return 'to';
});

```
| Parameter name      |  Type    | Description      |
| ------------------- | -------- | ---------------- |
| from    |  String   | The FTP path where "rget" will read data. |
| to | String or Function | The filesystem path, relative or absolute, where "rget" will write data or the function generate this path for data. |

The function 'to' can take 3 parameters :
- relativeFtpPath : the data ftp path
- type : 'file'|'folder'
- object : file or folder object
This function musts return a string represent the data normalized filesystem path.


With the context you can get 'files' and 'folders' concerned by the download.


Context functions :

```javascript
// All files
var filesArray = ctx.files;

// All folders
var foldersArray = ctx.folders;

//
var size = ctx.getTotalSize();

//
var size = ctx.getDownloadedSize();

//
var filesArray = ctx.getNotDownloadedFiles();

//
var filesArray = ctx.getDownloadedFiles();

//
var foldersArray = ctx.getNotExploredFolders();

//
var foldersArray = ctx.getExploredFolders();

//
var filePath = ctx.getFileSource(myFile);

// (on the file system)
var filePath = ctx.getFileDestination(myFile);

//
var folderPath = ctx.getFolderSource(myFolder);

// (on the file system)
var folderPath = ctx.getFolderDestination(myFolder);
```

__File__

Object structure :

```javascript
function () {
    "use strict";
    this.name = '';
    this.relativePath = '';
    this.size = 0;
    this.complete = 0;
};
```

__Folder__

Object structure :

```javascript
var FolderToDownload = function () {
    "use strict";
    this.name = '';
    this.relativePath = '';
    this.explored = false;
};
```


## Step 4 - Bind context events (if you want)
Context object extends "EventEmitter". So you can bind the event with callback function.

```javascript
ctx.on('evName', callback);
```

### Context event
- initialized : emit when all folders are explored
__Callback function is :__

```javascript
function() {
    ...
}
```
- finished : emit when all files are downloaded
__Callback function is :__

```javascript
function() {
    ...
}
```

### File or folder event
- fileAdded : emit when file is added to the context download list
__Callback function is :__

```javascript
function(folder) {
    ...
}
```
- folderExplored : emit when folder is added to the context explore list
__Callback function is :__

```javascript
function(folder) {
    ...
}
```
- downloadStart : emit when file download starting
__Callback function is :__

```javascript
function(file) {
    ...
}
```
- dataReceived : emit when data is received (see "stepDataEvent" parameter)
__Callback function is :__

```javascript
function(file) {
    ...
}
```
- downloadFinished : emit when file is downloaded
__Callback function is :__

```javascript
function(file) {
    ...
}
```

### Error event
- error : on error in process
__Callback function is :__

```javascript
function(err) {
    ...
}
```

- errorWithFile : on error with file
__Callback function is :__

```javascript
function(err, file) {
    ...
}
```

- timeoutWithFile : on connection timeout during file download
__Callback function is :__

```javascript
function(file) {
    ...
}
```

## Step 5 - Start download
```javascript
rgetClient.download(ctx);
```

Exemple
=========

```javascript
var rget = require('rget-jsftp');

ver rgetClient = rget.RGet({
    host: 'host',
    username: 'user',
    password: '12345',
    port: 21
});

var ctx = rgetClient.generateDownloadContext('from', 'to');

rgetClient.download(ctx);
```
