// This file is a horrible mess.
import { h, Fragment } from './dom.ts';
import { authenticate, decrypt, encrypt, totp } from './crypto.ts';
import { Input, post } from './global.tsx';

const {dek, username, sessionId} = authenticate() as { dek: Promise<CryptoKey>, username: string, sessionId: Uint8Array };
if (dek === undefined || username === undefined || sessionId === undefined) {
    window.location.href = '/login';
}

// WIP (currently deadcode): Building a better data structure for this mess.
type totpEntry = { name: string, interval: number, secret: string };
type totpCard = {
    name: string,
    interval: number,
    secret: string,
    card: HTMLElement,
    codeElmt: HTMLElement,
    donutElmt: HTMLElement,
    nameElmt: HTMLElement,
    editElmt: HTMLElement
};

class Totp {
    entries;
    counterInterval;
    updateInterval;
    container;
    cards: totpCard[] = [];

    counter;

    constructor(entries: totpEntry[]) {
        this.entries = entries;
        this.container = <div class='margin-center' id='container' style='width: min-content'></div>;
        entries.forEach(entry => this.addCard(entry, false));

        const now = Date.now();
        this.counter = now % 60000 > 30000 ? 1 : 0;

        // Timeouts and intervals share the same ID pool; cleanup can use clearInterval to handle this at any stage.
        this.updateCounters();
        this.counterInterval = setTimeout(() => {
            this.updateCounters();
            // Arrow function needed here to preserve access to 'this'
            this.counterInterval = setInterval(() => this.updateCounters(), 1000);
        }, 1000 - now % 1000);

        this.updateCodes();
        this.updateInterval = setTimeout(() => {
            this.updateCodes();
            this.updateInterval = setInterval(() => this.updateCodes(), 30000);
        }, 30000 - now % 30000);
    }

    updateCodes() {
        this.counter++;
        const now = Date.now();
        for (const card of this.cards) {
            if (card.interval === 60 && this.counter % 2 === 0) continue;

            this.updateCode(card, now);
        }
    }
    updateCode(card: totpCard, now: null | number = null) {
        const { secret, codeElmt, interval, donutElmt } = card;
        now ||= Date.now();

        totp(secret).then(code => {
            codeElmt.textContent = code.substring(0, 3) + '-' + code.substring(3);
        });

        donutElmt.classList.remove('animated');
        void donutElmt.offsetWidth; // This resets the animation.
        donutElmt.style.animationDelay = `-${now % (interval * 1000)}ms`;
        donutElmt.classList.add('animated');
    }

    updateCounters() {
        const now = Date.now();

        for (const card of this.cards) {
            this.updateCounter(card, now);
        }
    }
    updateCounter(card: totpCard, now: number | null = null) {
        now ||= Date.now();

        const { donutElmt, interval } = card;
        donutElmt.setAttribute('label', (interval - (now / 1000 % interval) >>> 0).toString());
    }

    addCard(entry: totpEntry, update = true) {
        const codeElmt = <span class='code'>___-___</span>;
        const donutElmt = <div class='donut' label='0'></div>;
        const editElmt = <a class='edit'>Edit</a>;
        const nameElmt = <span>{entry.name}</span>;

        const cardElmt = <div class='totp card' interval={entry.interval}>
            <div class='header'>{nameElmt}{editElmt}</div>
            {codeElmt}
            {donutElmt}
        </div>;

        const card = {
            card: cardElmt,
            codeElmt,
            donutElmt,
            nameElmt,
            editElmt,
            ...entry
        };

        this.container.appendChild(cardElmt);
        this.cards.push(card);

        if (update) {
            this.updateCode(card);
            this.updateCounter(card);
        }

        return card;
    }
    editCard(card: totpCard) {
        //
    }
}

function TotpCard(options: Record<'interval' | 'secret' | 'name' | 'index', any>) {
    const codeElmt = <span class='code'>___-___</span>;
    const donut = <div class='donut' label='0'></div>;

    async function updateCode() {
        const code = await totp(options.secret);
        codeElmt.textContent = code.substring(0, 3) + '-' + code.substring(3);
        donut.classList.remove('animated');
        void donut.offsetWidth; // This resets the animation.
        donut.classList.add('animated');
    }

    const interval = options.interval * 1000;
    const elapsed = Date.now() % interval;

    donut.style.animationDelay = `-${elapsed}ms`;
    donut.classList.add('animated');

    updateCode();
    setTimeout(() => {
        donut.style.animationDelay = `0s`;
        updateCode();
        setInterval(updateCode, interval);
    }, interval - elapsed);
    

    syncedInterval(() => {
        donut.setAttribute('label', (interval / 1000 - (Date.now() % interval / 1000) >>> 0).toString());
    }, 1000);

    const editElmt = <a class='edit'>Edit</a>;
    editElmt.addEventListener('click', event => {
        editEntry(options.index);
    });

    return (
        <div class='totp card' interval={options.interval}>
            <div class='header'>{options.name}{editElmt}</div>
            {codeElmt}
            {donut}
        </div>
    );
}

function TotpMenu() {
    const nameElmt = <Input id='name' placeholder='Service name' autocomplete='off' />;
    const secretElmt = <Input id='secret' placeholder='Secret' autocomplete='off' />
    const intervalElmt = <Input id='interval' placeholder='Interval' value='30' type='number' autocomplete='off' />;
    const saveBtn = <button class='btn disabled'>Save</button>;
    const deleteBtn = <button class='btn tertiary'>Delete</button>;

    const name = nameElmt.children[0] as HTMLInputElement;
    const secret = secretElmt.children[0] as HTMLInputElement;
    const interval = intervalElmt.children[0] as HTMLInputElement;

    for (const elmt of [name, secret, interval]) {
        elmt.addEventListener('input', validate);
    }

    function validate() {
        saveBtn.classList.toggle('disabled', !(name.value && secret.value && interval.value));
    }

    saveBtn.addEventListener('click', event => {
        if (saveBtn.classList.contains('disabled')) {
            for (const elmt of [name, secret, interval]) {
                if (!elmt.value) {
                    elmt.focus()
                    return;
                }
            }
            // Don't return if it's somehow broken (it is)
            // return;
        }

        saveEntry()
    });

    deleteBtn.addEventListener('click', event => {
        entries.splice(entry, 1);
        setData(JSON.stringify(entries));
        window.location.reload();
    });

    return (
        <div class='card l overlay center-anchor consume-focus'>
            <h2>Authenticator</h2>
            <p>Enter the details for the application.</p>
            {nameElmt}
            {secretElmt}
            {intervalElmt}
            {saveBtn}
            {deleteBtn}
        </div>
    );
}

async function getData() {
    const contents = (await post('/api/db', { sessionId: sessionId.toBase64(), key: 'totp' })).contents;
    if (contents) {
        return new TextDecoder().decode(await decrypt(Uint8Array.fromBase64(contents), await dek));
    }
    return null;
}

async function setData(data: string) {
    const encrypted = (await encrypt(new TextEncoder().encode(data), await dek)).toBase64();
    return post('/api/db', { sessionId: sessionId.toBase64(), key: 'totp', value: encrypted });
}

let data = await getData();
let entries = data ? JSON.parse(data) : [];

let entry = 0;
const menu = <TotpMenu />;
menu.style.display = 'none';

function editEntry(index: number) {
    menu.style.display = 'block';
    entry = index;

    const service = entries[index];
    (document.getElementById('name') as HTMLInputElement).value = service?.name || '';
    (document.getElementById('secret') as HTMLInputElement).value = service?.secret || '';
    (document.getElementById('interval') as HTMLInputElement).value = service?.interval.toString() || '30';
}

function saveEntry() {
    menu.style.display = 'none';
    const name = (document.getElementById('name') as HTMLInputElement);
    const secret = (document.getElementById('secret') as HTMLInputElement);
    const interval = (document.getElementById('interval') as HTMLInputElement);

    entries[entry] = { name: name.value, interval: parseFloat(interval.value), secret: secret.value }
    setData(JSON.stringify(entries));

    // TODO: Add dynamically
    window.location.reload();
}

function syncedInterval(callback: () => void, interval: number, delayExec = false) {
    if (!delayExec) callback();

    const elapsed = Date.now() % interval;

    setTimeout(() => {
        callback();
        setInterval(callback, interval);
    }, interval - elapsed);
}

async function App() {
    const container = <div class='margin-center' id='container' style='width: min-content'></div>;
    let i = 0;
    for (const service of entries) {
        container.append(<TotpCard name={service.name} interval={service.interval} secret={service.secret} index={i++} />);
    }

    const newButton = <button class='btn square'>+</button>;
    newButton.addEventListener('click', event => {
        editEntry(entries.length);
    });

    return (<>
        <div class='topnav'></div>
        {container}
        <div class='sp' style='margin-top: 88px'></div>
        <div class='se-anchor'>
            {newButton}
        </div>
        {menu}
    </>);
}

document.body.append(await App());