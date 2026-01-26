export const Argon2idSettings = {
    parallelism: 4,
    passes: 3,
    memorySize: 2**16,
    tagLength: 64
}

export async function sha256(data: Uint8Array) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
}

export async function encrypt(data: Uint8Array, key: CryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource)
    );

    const result = new Uint8Array(12 + encrypted.byteLength);
    result.set(iv, 0);
    result.set(encrypted, 12);

    return result;
}

export async function decrypt(data: Uint8Array, key: CryptoKey) {
    const iv = data.slice(0, 12);
    return new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data.slice(12))
    );
}

export function deriveAesGcmKey(secret: Uint8Array) {
    return crypto.subtle.importKey(
        'raw',
        secret as BufferSource,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function hkdf(secret: Uint8Array) {
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

export function xorUint8Array(arr0: Uint8Array, arr1: Uint8Array) {
    return arr0.map((x, i) => x ^ arr1[i]);
}

export function authenticate() {
    // Recover key from session
    if (window.name.length === 112) {
        const wrapper = Uint8Array.fromBase64(window.name);
        const wrapped = sessionStorage.getItem('wrappedData');

        if (wrapped === null) return {};
        const unwrapped = xorUint8Array(wrapper, Uint8Array.fromBase64(wrapped));
        const dek = deriveAesGcmKey(unwrapped.subarray(0, 32));
        const sessionId = unwrapped.subarray(32, 64);
        const username = new TextDecoder().decode(unwrapped.subarray(64, 84)).replace(/\0/g, '');
        return { username, sessionId, dek };
    }
    return {};
}

export async function hmacSHA1(secret: BufferSource, message: BufferSource) {
    const key = await crypto.subtle.importKey(
        'raw',
        secret,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign']
    );

    return new Uint8Array(
        await crypto.subtle.sign(
            'HMAC',
            key,
            message
        )
    );
}

export function atob32(base32: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    base32 = base32.replace(/=+/g, '').toUpperCase();
    const result = new Uint8Array((base32.length * 5 / 8) | 0);

    let buffer = 0;
    let bits = 0;
    let n = 0;

    for (let i = 0; i < base32.length; i++) {
        buffer = (buffer << 5) | alphabet.indexOf(base32[i]);
        bits += 5;

        if (bits >= 8) {
            result[n++] = (buffer >> (bits - 8)) & 0xff;
            bits -= 8;
        }
    }
    
    return result;
}

export async function totp(secret: string, step = 30, now = null) {
    let time = BigInt(Math.floor((now || Date.now()) / 1000 / step));
    const timeBuffer = new Uint8Array(8);

    // Convert the time to a big-endian byte array
    for (let i = 7; i >= 0; i--) {
        timeBuffer[i] = Number(time & 0xffn);
        time >>= 8n;
    }

    const hmac = await hmacSHA1(atob32(secret), timeBuffer);

    const offset = hmac[hmac.length - 1] & 0xf;
    const totp = (((hmac[offset] & 0x7f) << 24 |
                   (hmac[offset + 1] & 0xff) << 16 |
                   (hmac[offset + 2] & 0xff) << 8 |
                   (hmac[offset + 3] & 0xff)) >>> 0) % 1000000;
    
    return totp.toString().padStart(6, '0');
}