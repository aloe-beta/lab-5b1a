import http from 'node:http';

declare module 'http' {
    interface IncomingMessage {
        getBody(): Promise<string>;
        jsonBody(): Promise<Record<string, any>>;
    }
}

export {};