import Proxy from '../src/proxy';
const proxy = new Proxy(8080, '0.0.0.0', (username, password) => true);