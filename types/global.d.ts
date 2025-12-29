interface Uint8Array {
    toBase64(): string;
    toHex(): string;
}

interface Uint8ArrayConstructor {
    fromBase64(base64: string): Uint8Array
    fromHex(hex: string): Uint8Array
}