# ws-depression
Does ws-discovery via UDP UPnP. Forked from some dude. Thanks dude.

# Requirements
* node

# Documentation
https://crunchwrapsupreme.github.io/ws-depression/

# Installation
```shell
npm i --save @crunchwrapsupreme/ws-depression
```

# Credit
Built on top of a fork of https://github.com/do-/node-xml-toolkit

# Using
```typescript
import { discoverDeviceV4, discoverDeviceV6, deviceSocket } from 'ws-depression'

discoverDeviceV4().then(x => {
    const transports = x.map(x => x.transports);
    console.log(transports);
});

// ... initialize our cool socket first
deviceSocket(socket).then(deviceListener => {
    deviceListener.on('match', match => console.log(match.transports));
});
```

The promises returned by the discover functions resolve with a list of `ProbeMatch` objects. The is also the `socketFactory` and `deviceSocket` functions which provides more options for initialization.

## TODO
* tests