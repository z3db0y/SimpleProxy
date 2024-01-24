import { Server, Socket, createServer } from 'net';
import Parser, { Parser as NParser } from './parser';

type Result = NParser.Result;

export default class Proxy {
    private server: Server;
    private port: number;
    private host: string;
    private authCallback: (username: string, password: string) => boolean;
    private requestCallback: (request: Result) => Result;
    private intercept: boolean;
    private interceptCallback: (request: Result) => Result | null;

    constructor(
        port: number,
        host = '0.0.0.0',
        authCallback: (username: string, password: string) => boolean = () =>
            true,
        requestCallback: (request: Result) => Result = (req) => {
            return {
                isRequest: false,
                isResponse: true,
                headers: {},
                version: req.version,
                status: 200,
                body: Buffer.from(
                    `Proxy OK\nYou requested:\n${JSON.stringify(req, null, 4)}`
                ),
            };
        },
        intercept = false,
        interceptCallback: (request: Result) => Result | null = () => null
    ) {
        this.server = createServer(this.onConnect.bind(this));

        this.host = host;
        this.port = port;
        this.authCallback = authCallback;
        this.requestCallback = requestCallback;
        this.intercept = intercept;
        this.interceptCallback = interceptCallback;

        this.server.listen(port, host);
    }

    onConnect(socket: Socket) {
        let targetSocket: Socket | undefined;

        socket.on('data', this.onData.bind(this, socket, targetSocket));
        socket.on('error', this.onError.bind(this, socket, targetSocket));
    }

    async onData(socket: Socket, target: Socket | undefined, data: Buffer) {
        let request = Parser.parse(data);

        if (request && request.isRequest && !target) {
            let auth = request.headers['proxy-authorization'];
            let username = '';
            let password = '';
            if (
                auth &&
                !Array.isArray(auth) &&
                auth.toLowerCase().startsWith('basic ')
            ) {
                [username, password] = Buffer.from(
                    auth.split(' ').slice(1).join(' '),
                    'base64'
                )
                    .toString()
                    .split(':');
            }

            target = new Socket();

            let urlString =
                'http' + (request.method == 'CONNECT' ? 's' : '') + '://';
            if (!request.url!.includes('://')) urlString += request.url;
            else urlString = request.url!;

            let url = request.url!.startsWith('/')
                ? new URL('http://localhost' + request.url!)
                : new URL(urlString);

            if (request.url!.startsWith('/')) {
                // console.log(request.method, request.url);
                let response = this.requestCallback(request);

                socket.write(Parser.serialize(response)!);
                socket.end();
                return;
            }

            if (!this.authCallback(username, password)) {
                socket.write(
                    Parser.serialize({
                        isRequest: false,
                        isResponse: true,
                        headers: {
                            'Proxy-Authenticate': 'Basic',
                        },
                        version: request.version,
                        status: 407,
                        body: Buffer.from('Proxy authorization failed.'),
                    })!
                );
                socket.end();
                return;
            }

            // console.log(request.method, urlString);

            if (this.intercept) {
                let response = this.interceptCallback(request);
                if (response) {
                    socket.write(Parser.serialize(response)!);
                    socket.end();
                    return;
                }
            }

            target.on('error', this.onError.bind(this, socket, target));
            target.connect(
                parseInt(url.port) || (request.method == 'CONNECT' ? 443 : 80),
                url.hostname,
                () => {
                    socket.pipe(target!);
                    target!.pipe(socket);

                    if (request!.method != 'CONNECT') {
                        delete request!.headers['proxy-authorization'];
                        target!.write(Parser.serialize(request!)!);
                        return;
                    }

                    socket!.write(
                        Parser.serialize({
                            isRequest: false,
                            isResponse: true,
                            version: 1.1,
                            headers: {},
                            status: 200,
                            statusMessage: 'Connection Established',
                        })!
                    );
                }
            );
        }
    }

    onError(socket: Socket, target: Socket | undefined) {
        // TODO: maybe an error http response?
        if (target) target.end();
        target = undefined;
        socket.end();
    }
}
