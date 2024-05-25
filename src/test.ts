import Proxy from './proxy';
const proxy = new Proxy(
    8080,
    '0.0.0.0',
    (username, password) => true,
    null,
    true,
    (request, socket) => {
        console.log(request, socket.remoteAddress);
        
        if (
            new URL(request.url, 'http://127.0.0.1').hostname ==
            'is_on_simpleproxy'
        )
            return {
                isRequest: false,
                isResponse: true,
                headers: {},
                version: request.version,
                status: 200,
                body: Buffer.from('true'),
            };

        return null;
    }
);
