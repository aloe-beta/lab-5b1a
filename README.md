# Lab-5b1a
The name is a placeholder. This is the beginning of multiple frameworks I'm trying to create from scratch (only using a couple crypto libraries and built-in node modules).

Note: The frontend uses TSX through Vite without using React.

# Running
Make sure you have Node.JS and NPM installed. Clone the repo and cd into it.

```
npm install
```
Run the front-end dev server:
```
npm run frontend
```
Run the backend dev server (in another terminal):
```
npm run backend
```

# Design system
Still a work in progress. Check out `src/js/global.tsx` for a couple standard components. Also see `src/css/global.css`.

# Server framework
See `server.ts` for the implementation and `app.ts` for an example.

# Authentication Mechanism
**USE THIS AT YOUR OWN RISK. I am NOT a cybersecurity expert, and CANNOT gaurantee this to be secure.**

For end-to-end encrypted applications, it should be impossible for the server to decrypt the client's data. That poses a difficult challenge with authentication, as the client requires an encryption key the server can't provide upon re-authentication after the session ends or when the client wants to sign in on a new device.

To tackle that problem, I created a post-quantum Password Authenticated Key Exchange (PAKE) implementation that allows the client to prove its identity to the server without revealing anything about its encryption key, while being able to regenerate the key from its password.


**This is PAKE intended to be run on top of HTTPS.**
### Registration pseudo-code
```
const ARGON2ID_SETTINGS = {
    parallelism: 4,
    passes: 3,
    memory_size: 65536,
    tag_length: 64
}

// Client
const username, password;
let salt = RANDOM_BYTES(32);
let seed = ARGON2ID(password, salt, ARGON2ID_SETTINGS);

let { pk } = ML_KEM768::KEYGEN(seed);

// HKDF to make the secret the proper length
let kek = HKDF_HMAC(seed);
let dek = RANDOM_BYTES(32);
let iv = RANDOM_BYTES(12);
let wrapped_dek = CONCAT(iv, AES_256_GCM_ENC(dek, kek, iv));

POST("/api/register", {username, salt, pk, wrapped_dek})?;

// Server responds with a success or error code.
```
### Authentication pseudo-code
```
// Client
const username, password;
let {salt, cipher_text, nonce} = POST("/api/salt", {username})?;

// Server
#[post("/api/salt")]
fn SALT(username) {
    let Client = DB.GET_USER(username)?;
    // A nonce is created to prevent a possible DoS attack in which
    // an attacker requests new challenges faster than the client
    // can compute them, locking the specific user out for a time.
    let nonce = RANDOM_BYTES(16);
    
    let {pk} = Client;
    let msg = RANDOM_BYTES(32);
    {shared_secret, cipher_text} = ML_KEM768::ENCAPSULATE(pk, msg);

    // Store for up to 60 seconds
    TIMED_CACHE.SET(b"challenge:{username}:{nonce}", shared_secret);

    return {salt, cipher_text, nonce};
}

// Client (continues where it left off)
let seed = ARGON2ID(password, salt, ARGON2ID_SETTINGS);
let { pk, sk } = ML_KEM768::KEYGEN(seed);
let shared_secret = ML_KEM768::DECAPSULATE(cipher_text, sk);

let token = SHA256(CONCAT(shared_secret, pk, nonce));
let {wrapped_dek, session_id} = POST("/api/auth", {username, token, nonce});

// Server
#[post("/api/auth")]
fn AUTH(username, client_token, nonce) {
    let Client = DB.GET_USER(username)?;
    let challenge = TIMED_CACHE.POP(b"challenge:{username}:{nonce}")?;

    let {pk} = Client;
    let token = SHA256(CONCAT(shared_secret, pk, nonce));

    if token != client_token {
        return ERROR;
    }

    // Logic TBD for session_id
    let session_id = SESSIONS.CREATE(username);

    let {wrapped_dek} = Client;
    return {wrapped_dek, session_id};
}

// Client (continues where it left off)
let kek = HKDF(seed);
let iv = wrapped_dek[0..12];
let enc_dek = wrapped_dek[12...];
let dek = AES_256_GCM_DEC(enc_dek, kek, iv);
// The client is now authenticated and has its DEK.
```