# Simple Proxy

This is a script I wrote because I was bored in school; it provides a simple way of creating an HTTP proxy with request and authorization callback options.

## Usage:

```js
const Proxy = require('./proxy');
const proxy = new Proxy(8080, '0.0.0.0', (username, password) => true);
```

## Features:

- Supports HTTP/HTTPS and WebSockets.
- Custom authorization callback.
- Custom request callback to proxy.

## TODO:

- Implement support for MITM interception.