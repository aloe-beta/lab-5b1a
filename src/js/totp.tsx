import { h, Fragment } from './dom.ts';
import { authenticate, decrypt, encrypt, totp } from './crypto.ts';
import { Input, post, SegmentedSelect } from './global.tsx';

const {dek, username, sessionId} = authenticate() as { dek: Promise<CryptoKey>, username: string, sessionId: Uint8Array };
if (dek === undefined || username === undefined || sessionId === undefined) {
    window.location.href = '/login';
}

// TODO: Fix 60s interval

type totpEntry = { name: string, interval: number, secret: string };
type totpCard = {
    name: string,
    interval: number,
    secret: string,
    card: HTMLElement,
    codeElmt: HTMLElement,
    donutElmt: HTMLElement,
    nameElmt: Text,
    editElmt: HTMLElement
};

class Totp {
    entries;
    counterInterval;
    updateInterval;
    container;
    cards: totpCard[] = [];

    menu;
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

        // Sync animation on page refocus
        addEventListener('focus', () => this.updateCodes());

        // Edit menu/form
        this.menu = Totp.editMenu();
        this.menu.menu.style.display = 'none';
        this.container.appendChild(this.menu.menu);
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

    addCard(entry: totpEntry, update = true, append = true) {
        // Create card
        const codeElmt = <span class='code'>___-___</span>;
        const donutElmt = <div class='donut' label='0'></div>;
        const editElmt = <a class='edit'>Edit</a>;
        const nameElmt = document.createTextNode(entry.name);

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

        // Define behavior
        editElmt.addEventListener('click', event => {
            event.stopImmediatePropagation();
            this.editCard(card);
        });
        cardElmt.addEventListener('click', event => {
            navigator.clipboard.writeText(codeElmt.textContent.replace('-', ''));
        });

        // Append and update
        if (append) {
            this.container.appendChild(cardElmt);
            this.cards.push(card);
        }

        if (update) {
            this.updateCode(card);
            this.updateCounter(card);
        }
        return card;
    }
    editCard(card: totpCard | null) {
        const menu = this.menu;
        const { name, secret, interval, save: saveBtn, delete: deleteBtn, menu: menuElmt } = menu;
        if (card) {
            name.value = card.name;
            secret.value = card.secret;
            interval[card.interval === 30 ? 0 : 1].checked = true;
            saveBtn.classList.toggle('disabled', false);
        } else {
            name.value = '';
            secret.value = '';
        }

        name.addEventListener('input', validate);

        let valid = false;
        function validate() {
            valid = name.value !== '' && secret.value !== '';
            saveBtn.classList.toggle('disabled', !valid);
        }

        menuElmt.style.display = 'block';
        saveBtn.onclick = () => {
            validate();
            if (!valid) return;

            const intervalValue = interval[0].checked ? 30 : 60;

            if (card) {
                card.name = name.value;
                card.secret = secret.value;
                card.interval = intervalValue;

                card.nameElmt.textContent = name.value;
                this.updateCode(card);
                this.updateCounter(card);
            } else {
                this.addCard({ name: name.value, secret: secret.value, interval: intervalValue });
            }

            const cards = this.cards;

            this.save();
            menuElmt.style.display = 'none';
        }

        deleteBtn.onclick = () => {
            if (card) {
                this.cards.splice(this.cards.indexOf(card), 1);
                card.card.remove();
                this.save();
            }
            menuElmt.style.display = 'none';
        }
    }

    save() {
        const cards = this.cards;

        setData(JSON.stringify(this.cards.map(card => {
            return {
                name: card.name,
                secret: card.secret,
                interval: card.interval
            }
        })));
    }

    static editMenu() {
        const nameElmt = <Input id='name' placeholder='Service name' autocomplete='off' />;
        const secretElmt = <Input id='secret' placeholder='Secret' autocomplete='off' />
        const intervalElmt = <SegmentedSelect name='interval' options={{'30': ['30', 'i30'], '60': ['60', 'i60']}} />;
        const saveBtn = <button class='btn disabled'>Save</button>;
        const deleteBtn = <button class='btn tertiary'>Delete</button>;

        return {
            name: nameElmt.children[0] as HTMLInputElement,
            secret: secretElmt.children[0] as HTMLInputElement,
            interval: Array.from(intervalElmt.children).map(c => c.children[0] as HTMLInputElement),
            save: saveBtn,
            delete: deleteBtn,
            menu: (
                <div class='card l overlay center-anchor consume-focus'>
                    <h2>Authenticator</h2>
                    <p>Enter the details for the application.</p>
                    {nameElmt}
                    {secretElmt}
                    {intervalElmt}
                    {saveBtn}
                    {deleteBtn}
                </div>
            )
        }
    }
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

async function App() {
    let data = await getData();
    let entries = data ? JSON.parse(data) : [];

    const app = new Totp(entries);

    const newButton = <button class='btn square'>+</button>;
    newButton.addEventListener('click', event => {
        app.editCard(null);
    });

    return (<>
        <div class='topnav'></div>
        {app.container}
        <div class='sp' style='margin-top: 88px'></div>
        <div class='se-anchor'>
            {newButton}
        </div>
    </>);
}
document.body.appendChild(await App());