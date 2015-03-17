RGET-JSFTP
=========
A client FTP module to download files or folders with a connection pool for manage the FTP access.
This nodeJS module uses :
- [jsftp](https://github.com/sergi/jsftp "Go to GitHub") to connect and to request the FTP server
- [node-pool](https://github.com/coopernurse/node-pool "Go to GitHub") to manage the FTP connections

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
    'password': ''
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
```
| Parameter name      | Description      |
| ------------------- | ---------------- |
| from       | The FTP path where "rget" will read data. |
| to | The path in your filesystem, relative or absolute, where "rget" will write data. |

## Step 4 - Bind context events (if you want)
Context object extends "EventEmitter". So you can bind the event with callback function.

```javascript
ctx.on('evName', callback);
```

### Context event
- initialized
- finished

callback is :
```javascript
function() {
    ...
}
```
No parameter.

### File or folder event
- folderAdded
- folderExplored
- fileAdded
- downloadStart
- dataReceived
- downloadFinished
### Error event
- error
- errorWithFile


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
