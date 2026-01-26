import http from 'node:http';

http.IncomingMessage.prototype.getBody = function(this: http.IncomingMessage) {
    return new Promise(resolve => {
        let body = '';
        this.on('data', data => {
            body += data.toString();
        });
        this.on('end', () => {
            resolve(body);
        });
    });
};

http.IncomingMessage.prototype.jsonBody = async function(this: http.IncomingMessage) {
    try {
        return JSON.parse(await this.getBody());
    } catch {
        return {};
    }
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

class Server {
    httpServer: http.Server;
    paths;

    constructor() {
        this.paths = new Map();

        this.httpServer = http.createServer(async (req, res) => {
            const method = this.paths.get(req.method || '');
            if (!method) {
                this.errorHandler(400, req, res);
                return;
            }

            const path = method.get(req.url || '');
            if (!path) {
                this.errorHandler(404, req, res);
                return;
            }

            const response = await path(req, res);
            if (typeof response === 'object' && !res.headersSent && res.writable) {
                const [body, code = 200, headers = {}] = response;
                switch (typeof body) {
                    case 'object':
                        res.writeHead(code, {'Content-Type': 'application/json', ...headers});
                        res.end(JSON.stringify(body));
                        return;
                    case 'string':
                        res.writeHead(code, {'Content-Type': 'text/plain', ...headers});
                        res.end(body);
                    default:
                        res.writeHead(code, {'Content-Type': 'text/plain', ...headers});
                        res.end(body.toString());
                }
            }
        });
    }

    createHandler(method: string) {
        return (path: string, callback: Handler) => {
            if (!this.paths.has(method))
            this.paths.set(method, new Map());

            const map = this.paths.get(method) as Map<string, Handler>;
            map.set(path, callback);
        }
    }

    get = this.createHandler('GET');
    post = this.createHandler('POST');
    put = this.createHandler('PUT');
    delete = this.createHandler('DELETE');

    listen(...args: any[]) {
        this.httpServer.listen(...args);
    }

    errorHandler(code: number, req: http.IncomingMessage, res: http.ServerResponse) {
        res.writeHead(code, {'Content-Type': 'text/plain'});
        res.end(code.toString());
    }
}

export default Server;