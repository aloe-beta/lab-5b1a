import fs from 'node:fs';
import path from 'node:path';

function sanitize(string: string) {
    return Buffer.from(string).toBase64();
}

// Unoptimized, inefficient, synchronous implementation of a basic blob database
export class BlobStore {
    dir: string;

    constructor(dir: string) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) {
            throw "Must be directory";
        }

        this.dir = dir;
    }

    get(bin: string, key: string, offset = 0, length = 0) {
        bin = sanitize(bin), key = sanitize(key);
        const location = path.join(this.dir, bin, key);
        const stat = fs.statSync(location);

        if (!stat.isFile()) {
            return null;
        }

        if (length === 0) length = stat.size - offset;
        if (stat.size - offset < length) {
            return null;
        }

        const fd = fs.openSync(location, 'r');
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, offset);

        return buffer;
    }

    set(bin: string, key: string, value: Buffer, offset = 0) {
        bin = sanitize(bin), key = sanitize(key);
        const location = path.join(this.dir, bin, key);
        const stat = fs.statSync(location);

        if (!stat.isFile() || stat.size < offset) {
            return false;
        }

        const fd = fs.openSync(location, 'w');
        fs.writeSync(fd, value, 0, null, offset);

        return true;
    }

    delete(bin: string, key: string) {
        bin = sanitize(bin), key = sanitize(key);
        const location = path.join(this.dir, bin, key);
        const stat = fs.statSync(location);

        if (!stat.isFile()) {
            return false;
        }

        fs.rmSync(location);
        return true;
    }

    createBin(bin: string) {
        bin = sanitize(bin);
        const location = path.join(this.dir, bin);

        if (fs.existsSync(location)) return false;

        fs.mkdirSync(location);
        return true;
    }

    deleteBin(bin: string) {
        bin = sanitize(bin);
        const location = path.join(this.dir, bin);

        if (!fs.existsSync(location)) return false;

        fs.rmSync(location, { recursive: true, force: true });
        return true;
    }
}

// Unoptimized, inefficient, potentially unstable implementation of the user database
// Also potentially dangerous given the nature of objects (e.g., if a username is 'toString')
export class UserDatabase {
    file: string;
    db: Record<'users' | 'names' | 'sessions', any>;

    constructor(file: string) {
        this.file = file;
        
        let db;
        if (!fs.existsSync(file)) {
            db = {
                users: {},
                names: {},
                sessions: {}
            };

            fs.writeFileSync(file, JSON.stringify(db));
        } else {
            db = JSON.parse(fs.readFileSync(file).toString());
        }

        this.db = db;
    }

    // Power loss would not be great here.
    flush() {
        fs.writeFileSync(this.file, JSON.stringify(this.db));
    }

    create(id: string, username: string, data: Record<string, string>) {
        const db = this.db;

        if (db.names[username] || db.users[id]) {
            return false;
        }

        db.users[id] = { ...data, username };
        db.names[username] = id;

        this.flush();
        return true;
    }

    delete(id: string) {
        const db = this.db;

        const user = db.users[id];
        if (!user) {
            return false;
        }

        delete db.names[user.username]
        delete db.users[id];
        // TODO: Delete sessions

        this.flush();
        return true;
    }

    get(id: string) {
        return this.db.users[id];
    }

    set(id: string, key: string, value: string) {
        const db = this.db;
        const user = db.users[id];
        if (!user) {
            return false;
        }

        user[key] = value;
        this.flush();
        return true;
    }

    has(id: string) {
        return this.db.users.hasOwnProperty(id);
    }

    hasName(name: string) {
        return this.db.names.hasOwnProperty(name);
    }

    getByName(name: string) {
        return this.db.users[this.db.names[name]] || null;
    }
}

// Cache with timed deletion
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