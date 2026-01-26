import Server from './server.ts';
import crypto from 'node:crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { TimedStore, BlobStore, UserDatabase } from './database.ts';

const PORT = 5080;

async function sha256(data: any) {
    return crypto.createHash('sha256').update(data).digest();
}

const db = new UserDatabase('.data/users.json');
const store = new BlobStore('.data/blobs');
const cache = new TimedStore(60);

const server = new Server;

function usernameInvalid(username: any) {
    return !(typeof username === 'string' && /^[a-z0-9.]{4,20}$/i.test(username));
}

function invalid(base64: any, length: number) {
    return !(
        typeof base64 === 'string' &&
        base64.length === length &&
        /^[a-z0-9+/]*={0,2}$/i.test(base64)
    );
}

server.post('/api/username', async req => {
    const {username} = await req.jsonBody();
    if (typeof username !== 'string') {
        return [{ error: 'Malformed Request' }, 400];
    }
    if (db.hasName(username)) {
        return [{ error: 'Username taken' }, 409];
    }

    return [{}];
});

server.post('/api/register', async req => {
    const {username, pk, salt, wdek, rdek} = await req.jsonBody();

    const malformed = usernameInvalid(username)
        || invalid(pk, 1580)
        || invalid(salt, 44)
        || invalid(wdek, 80)
        || rdek !== null && invalid(rdek, 80); // Optional

    if (malformed) {
        return [{ error: 'Malformed request' }, 400];
    }
    if (db.hasName(username)) {
        return [{ error: 'Username taken' }, 409];
    }

    const uid = crypto.randomBytes(32).toBase64();
    store.createBin(uid);

    let success = db.create(uid, username, { pk, salt, wdek, rdek });
    if (!success) {
        return [{ error: '' }, 500];
    }

    return [{}];
});

server.post('/api/salt', async req => {
    const {username} = await req.jsonBody();
    if (usernameInvalid(username)) {
        return [{ error: 'Malformed request' }, 400];
    }
    const user = db.getByName(username);
    if (user === undefined) {
        return [{ error: 'User not found' }, 404];
    }
    
    const nonce = crypto.randomBytes(16).toBase64();
    const pk = Uint8Array.fromBase64(user.pk);
    
    const {cipherText, sharedSecret} = ml_kem768.encapsulate(pk, crypto.randomBytes(32));
    cache.set(`challenge:${username}:${nonce}`, sharedSecret.toBase64());

    return [{ salt: user.salt, cipherText: cipherText.toBase64(), nonce }];
});

server.post('/api/auth', async req => {
    const {username, token: client_token, nonce} = await req.jsonBody();
    const malformed = usernameInvalid(username)
        || invalid(client_token, 44)
        || invalid(nonce, 24);

    if (malformed) {
        return [{ error: 'Malformed request' }, 400];
    }
    const user = db.getByName(username);
    if (user === undefined) {
        return [{ error: 'Invalid credentials' }, 401];
    }

    let challenge: string | null | Uint8Array = cache.pop(`challenge:${username}:${nonce}`);
    if (challenge === null) {
        return [{ error: 'Invalid credentials' }, 401];
    }
    challenge = Uint8Array.fromBase64(challenge);

    const pk = Uint8Array.fromBase64(user.pk);
    let token: Uint8Array | string = new Uint8Array(challenge.byteLength + pk.byteLength + 16);
    token.set(challenge, 0);
    token.set(pk, challenge.byteLength);
    token.set(Uint8Array.fromBase64(nonce), challenge.byteLength + pk.byteLength);

    token = (await sha256(token)).toBase64();
    if (token !== client_token) {
        return [{ error: 'Invalid credentials' }, 401];
    }

    const sessionId = crypto.randomBytes(32).toBase64();
    
    return [{ wdek: user.wdek, sessionId }];
});

// server.post('/api/db', async req => {
//     const { sessionId, key } = await req.jsonBody(); 
//     if (invalid(sessionId, 44) || key.length > 128 || key.length === 0) {
//         return [{ error: 'Malformed request' }, 400];
//     }

//     //
// });
// server.get('/api/db', async req => {
//     //
// });

server.listen(PORT, () => {
    console.log(`http://127.0.0.1:${PORT}`);
});