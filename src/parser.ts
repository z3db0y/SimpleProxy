export namespace Parser {
    export interface Result {
        isResponse: boolean;
        isRequest: boolean;
        version: number;
        method?: string;
        status?: number;
        statusMessage?: string;
        url?: string;
        headers: {
            [key: string]: string | string[];
        };
        body?: Buffer;
    }
}

export default new (class Parser {
    parse(buf: Buffer): Parser.Result | null {
        let lines = buf.toString().split('\r\n');

        let split = lines[0].split(' ');
        let last = split[split.length - 1].split('/');
        let first = split[0].split('/');

        let isRequest = last.length == 2 && last[0] == 'HTTP' && !isNaN(parseFloat(last[1]));
        let isResponse = first.length == 2 && first[0] == 'HTTP' && !isNaN(parseFloat(first[1]));

        if(!isRequest && !isResponse) return null;

        let result: Parser.Result = {
            isRequest,
            isResponse,
            version: isRequest ? parseFloat(last[1]) : parseFloat(first[1]),
            method: isRequest ? split[0].toUpperCase() : undefined,
            url: isRequest ? split[1] : undefined,
            status: isResponse ? parseInt(split[1]) : undefined,
            statusMessage: isResponse ? split.slice(2).join(' ') : undefined,
            headers: {}
        };

        let headersEnd = -1;
        for(let i = 1; i < lines.length; i++) {
            let line = lines[i];
            if(!line) {
                headersEnd = i;
                break;
            }

            let [key, ...valArray] = line.split(': ');
            key = key.toLowerCase();
            let value = valArray.join(':');

            if(result.headers[key]) {
                if(typeof result.headers[key] === 'string') {
                    result.headers[key] = [
                        result.headers[key] as string,
                        value
                    ];
                } else (result.headers[key] as string[]).push(value);
            } else result.headers[key] = value;
        }

        if(lines.length > headersEnd + 1) {
            let headBytelength = Buffer.from(lines.slice(0, headersEnd).join('\r\n') + '\r\n\r\n').byteLength;
            if(buf.length >= headBytelength) result.body = buf.subarray(headBytelength);
        }

        return result;
    }

    serialize(result: Parser.Result): Buffer | null {
        let header = '';

        if(!result.isRequest && !result.isResponse) return null;

        if(result.isRequest) {
            header += `${result.method} ${result.url} HTTP/${result.version}\r\n`;
        } else {
            header += `HTTP/${result.version} ${result.status} ${result.statusMessage || ''}\r\n`;
        }

        result.headers['content-length'] = (result.body ? result.body.byteLength : 0) + '';

        for(let [key, value] of Object.entries(result.headers)) {
            key = key.slice(0, 1).toUpperCase() + key.slice(1).replace(/-([a-z])/g, m => m.toUpperCase());
            
            if(Array.isArray(value)) for(let v of value) header += key + ': ' + v + '\r\n';
            else header += key + ': ' + value + '\r\n';
        }

        header += '\r\n';
        let ret = [Buffer.from(header)];

        if(result.body) ret.push(result.body);
        return Buffer.concat(ret);
    }
})();