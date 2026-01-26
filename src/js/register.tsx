import { post, PasswordInput, UsernameInput, TopNav } from './global.tsx';
import { h, Fragment } from './dom.ts';

const body = document.body;

function RegistrationScreen(next: () => void) {
    const usernameContainer = <UsernameInput id='username' tooltip='Try another. Use 4+ letters, numbers, and periods.' />;
    const passwordContainer = <PasswordInput id='password' tooltip='Mix 12+ numbers, letters, and symbols.' autocomplete='new-password' />;
    const nameElmt = usernameContainer.children[0] as HTMLInputElement;
    const passElmt = passwordContainer.children[0] as HTMLInputElement;
    const nextBtn = <button class='btn disabled'>Next</button>

    let nameValid = false;
    let usernameCheckTimeout: any;

    nameElmt.addEventListener('input', () => {
        nameValid = false;
        nextBtn.classList.add('disabled');
        clearTimeout(usernameCheckTimeout);
        usernameCheckTimeout = setTimeout(checkUsernameAvailability, 750);
    });
    nameElmt.addEventListener('change', () => {
        nameValid = false;
        clearTimeout(usernameCheckTimeout);
        checkUsernameAvailability();
    });
    passElmt.addEventListener('input', checkForm);

    nextBtn.addEventListener('click', async () => {
        if (nextBtn.classList.contains('disabled')) {
            if (nameValid) {
                passElmt.focus();
            } else {
                nameElmt.focus();
            }
            return;
        }

        const { error } = await register(nameElmt.value, passElmt.value);
        if (error) {
            nameElmt.setCustomValidity("Unknown");
        } else {
            next();
        }
    });

    async function checkUsernameAvailability() {
        const username = nameElmt.value;
        usernameCheckTimeout = undefined;
        nameElmt.setCustomValidity("");

        // Don't bother making a request if the username is invalid
        const valid = nameElmt.checkValidity() && username !== '';
        if (!valid) {
            return;
        }

        const { error } = await post('/api/username', {username});
        if (error) {
            nameElmt.setCustomValidity(error);
            return;
        }

        nameElmt.setCustomValidity("");
        nameValid = valid;
        checkForm();
    }

    function checkForm() {
        if (nameValid && passElmt.checkValidity() && passElmt.value !== '') {
            nextBtn.classList.remove('disabled');
        } else {
            nextBtn.classList.add('disabled');
        }
    }

    return (
        <div class='card l overlay center'>
            <h2>Register</h2>
            <p class='secondary'>Create an account.</p>
            {usernameContainer}
            {passwordContainer}
            {nextBtn}
            <div class='form-width center'>Have an account? <a href="/login.html">Login</a>.</div>
        </div>
    );
}

// function TwoFactorSetupScreen(next: () => void) {
//     const nextBtn = <a>later</a>;
//     nextBtn.onclick = next;
    
//     const form = (
//         <div class='card l overlay center'>
//             <h3>2nd Factor Setup</h3>
//             <nav class='hub'>
//                 <div class='tile'>Authenticator app</div>
//                 <div class='tile'>Security key</div>
//                 {/* <div class='tile'>Email me a code</div> */}
//             </nav>
//             <div class='form-width center'>Setup {nextBtn}.</div>
//         </div>
//     );

//     return form
// }

function RegistrationForm() {
    const registration = RegistrationScreen(() => {
        // Called upon successful registration
        window.location.href = "/login.html";
    });

    // NOTE: Dead code to be implemented (see bip39.tsx)

    // const keyCreation = (
    //     <div class='card l overlay center'>
    //         <h3>Recovery Key</h3>
    //         <p class='secondary'>Write down these words in order. This is the <strong>only way</strong> to recover your account if you lose your password.</p>
    //         {renderBip39Key(words)}
    //         <div class="form-width right">Or you can <a href="">print</a> it.</div>
    //         <button class='btn'>I wrote it down</button>
    //         <div class='form-width center'>Setup <a href="">later</a>.</div>
    //     </div>
    // );

    // const keyVerification = (
    //     <div class='card l overlay center'>
    //         <h3>Verify Key</h3>
    //         <p class='secondary'>Fill in the blanks by typing or selecting from the drop down menu.</p>
    //         {bip39Verification(words)}
    //         <button class='btn'>Continue</button>
    //     </div>
    // );

    return (<>
        {registration}
        <div class='sp'></div>
    </>);
}

function App() {
    return (<>
        <TopNav />
        <div class='sp xl'></div>
        <RegistrationForm></RegistrationForm>
    </>);
}

body.append(App());

import loadArgon2idWasm from './argon2id.min.mjs';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { Argon2idSettings, hkdf, deriveAesGcmKey, encrypt } from './crypto.ts';

const argon2id = await loadArgon2idWasm();

async function register(username: string, password: string) {
    if (password.length < 8 || password.length > 4096)
        return { error: 'Invalid password length' };

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const seed = argon2id({
        password: new TextEncoder().encode(password),
        salt,
        ...Argon2idSettings
    });

    const {publicKey: pk} = ml_kem768.keygen(seed);

    const kek = await hkdf(seed);
    const dek = crypto.getRandomValues(new Uint8Array(32));
    const wdek = (await encrypt(dek, kek)).toBase64();

    const { error } = await post('/api/register', {
        username,
        pk: pk.toBase64(),
        wdek,
        rdek: null,
        salt: salt.toBase64()
    });
    if (error) {
        return { error };
    }

    return {};
}