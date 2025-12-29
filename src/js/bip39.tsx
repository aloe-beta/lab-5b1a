// NOTE: This is all currently dead code.
import { h, Fragment } from './dom.ts';

let wordlist: string[] | undefined;
export async function generateBip39Key() {
    if (!wordlist) {
        wordlist = (await (await fetch('../static/bip39-english.txt')).text()).split('\n');
    }

    let key = [];
    for (let i = 0; i < 12; i++) {
        key.push(wordlist[Math.floor(Math.random() * 2048)]);
    }

    return key;
}

export function renderBip39Key(words: string[]) {
    let root = <div></div>;
    for (let row = 0; row < 4; row++) {
        let container = <div class='center-row'></div>;
        for (let col = 0; col < 3; col++) {
            container.append(<span class='value' style='width: 88px; padding: 8px 0;'>{words[row * 3 + col]}</span>);
        }
        root.append(container);
    }
    return root;
}

export function bip39Input() {
    let root = <div></div>;
    for (let row = 0; row < 4; row++) {
        let container = <div class='center-row'></div>;
        for (let col = 0; col < 3; col++) {
            container.append(<input maxlength='8' type='text' placeholder='---' class='value' style='width: 88px; padding: 0;' />);
        }
        root.append(container);
    }
    return root;
}

export function bip39Verification(words: string[]) {
    const root = <div></div>;
    for (let row = 0; row < 4; row++) {
        const container = <div class='center-row'></div>;
        const blank = Math.floor(Math.random() * 3);
        for (let col = 0; col < 3; col++) {
            if (blank === col) {
                container.append(<input maxlength='8' type='text' placeholder='---' class='value' style='width: 88px; padding: 0;' />);
            } else {
                container.append(<span class='value' style='width: 88px; padding: 8px 0;'>{words[row * 3 + col]}</span>);
            }
        }
        root.append(container);
    }
    return root;
}