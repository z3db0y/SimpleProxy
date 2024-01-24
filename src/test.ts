import Proxy from './proxy';
const proxy = new Proxy(
    8080,
    '0.0.0.0',
    (username, password) => true,
    null,
    true,
    (request) => {
        if (new URL(request.url).hostname == 'is_on_simpleproxy')
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
