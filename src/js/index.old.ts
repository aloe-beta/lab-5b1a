import loadArgon2idWasm from './argon2id.min.mjs';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

addEventListener('error', e => {
    alert(e.message);
})

const argon2id = await loadArgon2idWasm();

const Argon2idSettings = {
    parallelism: 4,
    passes: 3,
    memorySize: 2**16,
    tagLength: 64
}

async function sha256(data: Uint8Array) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
}

async function post(url: string, body: any) {
    return (await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body)
    })).json();
}

async function encrypt(data: Uint8Array, key: CryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource)
    );

    const result = new Uint8Array(12 + encrypted.byteLength);
    result.set(iv, 0);
    result.set(encrypted, 12);

    return result;
}

async function decrypt(data: Uint8Array, key: CryptoKey) {
    const iv = data.slice(0, 12);
    return new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data.slice(12))
    );
}

function deriveAesGcmKey(secret: Uint8Array) {
    return crypto.subtle.importKey(
        'raw',
        secret as BufferSource,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function hkdf(secret: Uint8Array) {
    const argonKey = await crypto.subtle.importKey(
        'raw',
        secret as BufferSource,
        'HKDF',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(),
            info: new TextEncoder().encode("User Encryption Key AES-256-GCM")
        },
        argonKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// TODO: Add support for a BIPS-39 recovery key
async function register(username: string, password: string) {
    if (password.length < 8 || password.length > 4294967295)
        return false;

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const secret = argon2id({
        password: new TextEncoder().encode(password),
        salt,
        ...Argon2idSettings
    });

    const {publicKey: pk} = ml_kem768.keygen(secret);

    const kek = await hkdf(secret);
    const dek = crypto.getRandomValues(new Uint8Array(32));
    const wdek = (await encrypt(dek, kek)).toBase64();

    const rawRecovery = crypto.getRandomValues(new Uint8Array(32));
    const recovery = await deriveAesGcmKey(rawRecovery);
    const rdek = (await encrypt(dek, recovery)).toBase64();

    const {error} = await post('/api/register', {
        username,
        pk: pk.toBase64(),
        wdek,
        rdek,
        salt: salt.toBase64()
    });
    if (error) {
        return { error };
    }

    return {
        recovery: rawRecovery.toBase64()
    };
}

async function login(username: string, password: string) {
    if (password.length < 8 || password.length > 4294967295)
        return false;

    let {salt, cipherText, nonce, error: salt_error} = await post('/api/salt', { username });
    if (salt_error) {
        return false;
    }

    const secret = argon2id({
        password: new TextEncoder().encode(password),
        salt: Uint8Array.fromBase64(salt),
        ...Argon2idSettings
    });

    const {publicKey: pk, secretKey: sk} = ml_kem768.keygen(secret);

    cipherText = Uint8Array.fromBase64(cipherText);
    const challenge = ml_kem768.decapsulate(cipherText, sk);

    let token: Uint8Array | string = new Uint8Array(challenge.byteLength + pk.byteLength + 16);
    token.set(challenge, 0);
    token.set(pk, challenge.byteLength);
    token.set(Uint8Array.fromBase64(nonce), challenge.byteLength + pk.byteLength);

    token = (await sha256(token)).toBase64();
    const {error: auth_error, wdek, sessionId} = await post('/api/auth', { username, token, nonce });
    if (auth_error) {
        return false;
    }

    const kek = await hkdf(secret);
    const dek = await deriveAesGcmKey(
        await decrypt(Uint8Array.fromBase64(wdek), kek)
    );

    return { dek, sessionId };
}

const usernameInp = document.getElementById('username') as HTMLInputElement;
const passwordInp = document.getElementById('password') as HTMLInputElement;
const loginBtn = document.getElementById('login') as HTMLButtonElement;

loginBtn.addEventListener('click', event => {
    login(usernameInp.value, passwordInp.value);
});

// const t1 = performance.now();
console.log(await register('jdoe', 'abcdefghij'));
// const t2 = performance.now();
console.log(await login('jdoe', 'abcdefghij'));
// const t3 = performance.now();
// alert(t2 - t1);
// alert(t3 - t2);