import { post, PasswordInput, UsernameInput, Checkbox, TopNav } from './global.tsx';
import { h, Fragment } from './dom.ts';

import { xorUint8Array } from './crypto.ts';

function LoginForm() {
    const button = <button class='btn disabled'>Sign in</button>;
    const nameElmt = <UsernameInput id='username' />, passElmt = <PasswordInput id='password' />;
    const trustElmt = <Checkbox id='trust'>Remember me</Checkbox>;
    const name = nameElmt.children[0] as HTMLInputElement;
    const pass = passElmt.children[0] as HTMLInputElement;

    name.addEventListener('input', check);
    pass.addEventListener('input', check);
    name.addEventListener('keydown', changeFocus);
    pass.addEventListener('keydown', changeFocus);

    let nameValid = false, passValid = false;

    function check() {
        name.setCustomValidity('');
        pass.setCustomValidity('');
        nameValid = name.checkValidity() && name.value !== '';
        passValid = pass.checkValidity() && pass.value !== '';
        button.classList.toggle('disabled', !(nameValid && passValid));
    }

    function changeFocus(event: KeyboardEvent) {
        if (event.key !== 'Enter') return;
        if (event.target === name && nameValid) {
            pass.focus();
            return;
        }
        if (event.target === pass && !button.classList.contains('disabled')) {
            button.click();
        }
    }

    button.addEventListener('click', async event => {
        if (button.classList.contains('disabled')) {
            (nameValid ? pass : name).focus();
            return;
        }

        const { error } = await login(name.value, pass.value);
        if (error) {
            button.classList.add('disabled');
            return;
        }

        // At this point, the user should be authenticated.
        const trusted = (trustElmt.children[0] as HTMLInputElement).checked;

        if (trusted) {
            // TODO: Implement persistent multi-session auth without storing the key on disk
        }

        window.location.href = "/dashboard.html";
    });

    return (
        <div class='card l overlay center'>
            <h2>Sign in</h2>
            <p>Enter your account details.</p>
            {nameElmt}
            {passElmt}
            {trustElmt}
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
    const rawDek = await decrypt(Uint8Array.fromBase64(wdek), kek);

    // Copy Proton's XOR trick using window.name to allow page refreshes while preventing data from being dumped to the disk via session storage
    const userdata = new Uint8Array(84);
    userdata.set(rawDek, 0);
    userdata.set(Uint8Array.fromBase64(sessionId), 32);
    userdata.set(new TextEncoder().encode(username), 64);

    console.log(userdata, rawDek);

    const wrapper = crypto.getRandomValues(new Uint8Array(84));
    window.name = wrapper.toBase64();
    const wrapped = xorUint8Array(userdata, wrapper);
    sessionStorage.setItem('wrappedData', wrapped.toBase64());

    return { sessionId };
}