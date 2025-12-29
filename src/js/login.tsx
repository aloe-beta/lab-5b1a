import { post, PasswordInput, UsernameInput, TopNav } from './global.tsx';
import { h, Fragment } from './dom.ts';

function LoginForm() {
    const button = <button class='btn disabled'>Sign in</button>;
    const nameElmt = <UsernameInput id='username' />, passElmt = <PasswordInput id='password' />;
    const name = nameElmt.children[0] as HTMLInputElement;
    const pass = passElmt.children[0] as HTMLInputElement;

    name.addEventListener('input', check);
    pass.addEventListener('input', check);

    let nameValid = false, passValid = false;

    function check() {
        name.setCustomValidity('');
        pass.setCustomValidity('');
        nameValid = name.checkValidity() && name.value !== '';
        passValid = pass.checkValidity() && pass.value !== '';
        button.classList.toggle('disabled', !(nameValid && passValid));
    }

    button.addEventListener('click', async event => {
        if (button.classList.contains('disabled')) {
            (nameValid ? pass : name).focus();
            return;
        }

        const { dek, error } = await login(name.value, pass.value);
        if (error) {
            button.classList.add('disabled');
            return;
        }

        // At this point, the user should be authenticated.
        // TODO: Implement persistent authentication
        window.location.href = "/dashboard.html";
    });

    return (
        <div class='card l overlay center'>
            <h2>Sign in</h2>
            <p>Enter your account details.</p>
            {nameElmt}
            {passElmt}
            {button}
            <div class='form-width center'>Need an account? <a href="/register">Sign up</a>.</div>
        </div>
    );
}

function App() {
    return (<>
        <TopNav />
        <div class='sp xl'></div>
        <LoginForm />
    </>);
}

document.body.appendChild(App());

import loadArgon2idWasm from './argon2id.min.mjs';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { Argon2idSettings, sha256, hkdf, deriveAesGcmKey, decrypt } from './crypto.ts';

const argon2id = await loadArgon2idWasm();

async function login(username: string, password: string) {
    if (password.length < 8 || password.length > 4096)
        return { error: 'Password must be between 8 and 4096 characters.' };

    let {salt, cipherText, nonce, error: salt_error} = await post('/api/salt', { username });
    if (salt_error) {
        return { error: salt_error };
    }

    const seed = argon2id({
        password: new TextEncoder().encode(password),
        salt: Uint8Array.fromBase64(salt),
        ...Argon2idSettings
    });

    const {publicKey: pk, secretKey: sk} = ml_kem768.keygen(seed);

    cipherText = Uint8Array.fromBase64(cipherText);
    const sharedSecret = ml_kem768.decapsulate(cipherText, sk);

    let token: Uint8Array | string = new Uint8Array(sharedSecret.byteLength + pk.byteLength + 16);
    token.set(sharedSecret, 0);
    token.set(pk, sharedSecret.byteLength);
    token.set(Uint8Array.fromBase64(nonce), sharedSecret.byteLength + pk.byteLength);

    token = (await sha256(token)).toBase64();
    const {error: auth_error, wdek, sessionId} = await post('/api/auth', { username, token, nonce });
    if (auth_error) {
        return { error: auth_error };
    }

    const kek = await hkdf(seed);
    const dek = await deriveAesGcmKey(
        await decrypt(Uint8Array.fromBase64(wdek), kek)
    );

    return { dek, sessionId };
}