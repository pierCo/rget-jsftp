RGET
=========
An FTP getter for files or folders.

Installation
=========


How to use
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
The object 'ctx' emits events :
- initialized
- folderAdded
- folderExplored
- fileAdded
- downloadStart
- dataReceived
- downloadFinished
- finished
- error
- errorWithFile

Configuration
=========
## FTP connection

## Pool

## rget

How does it work
=========
