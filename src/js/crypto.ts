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