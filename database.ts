import fs from 'node:fs';

class Database {
    constructor(dir: string) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) {
            throw "Must be directory";
        }
    }

    get(user: string, ) {}
}

export class TimedStore {
    #store: Map<string, [number, string]>;
    constructor(ttl: number, frequency: number = 10) {
        this.#store = new Map();
        setInterval(() => {
            let now = performance.now();
            this.#store.forEach(([timestamp], key) => {
                if (now - timestamp > ttl * 1000) this.#store.delete(key);
            });
        }, frequency * 1000);
    }

    set(key: string, value: string) {
        this.#store.set(key, [performance.now(), value]);
    }

    get(key: string) {
        return this.#store.get(key)?.[1] || null;
    }

    delete(key: string) {
        this.#store.delete(key);
    }

    pop(key: string) {
        let value = this.#store.get(key)?.[1] || null;
        this.#store.delete(key);
        return value;
    }
}