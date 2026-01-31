import { h } from './dom.ts';

export async function post(url: string, body: any) {
    return (await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body)
    })).json();
}

declare global {
    interface Window {
        theme: 'light' | 'dark';
    }

    type templateOptions = Record<string, string | number | boolean | HTMLElement>;
}

let theme = 'light';
Object.defineProperty(window, 'theme', {
    get() {
        return theme;
    },
    set(value) {
        if (value === 'light' || value === 'dark') {
            theme = value;
            document.body.classList.toggle('dark', value === 'dark');
            document.body.classList.toggle('light', value === 'light');
            return true;
        }
        return false;
    }
});

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        window.theme = window.theme === 'light' ? 'dark' : 'light';
    });
}

export function Input(options: templateOptions) {
    const params = {type: 'text', id: '', ...options, tooltip: undefined, button: undefined, class: undefined, placeholder: ' '};
    delete params.tooltip;
    delete params.button;
    delete params.class;

    const tooltip = options.tooltip && <div class='tooltip'>{options.tooltip}</div>;
    const placeholder = options.placeholder && <label for={params.id}>{options.placeholder}</label>;
    return (
        <div class={'input ' + options.class}>
            <input {...params} />
            {placeholder}
            {options.button}
            {tooltip}
        </div>
    );
}

export function UsernameInput(options?: templateOptions) {
    return Input({
        minlength: 4,
        maxlength: 20,
        placeholder: 'Username',
        pattern: '[a-zA-Z0-9.]{4,20}',
        tooltip: 'Try a different username.',
        autocomplete: 'username',
        ...(options || {})
    });
}

export function PasswordInput(options?: templateOptions) {
    options ||= {};
    const button = <button>S</button>;
    const element = Input({
        type: 'password',
        minlength: 12,
        maxlength: 4096,
        placeholder: 'Password',
        pattern: '(?=.*[a-zA-Z])(?=.*\\d)(?=.*[^a-zA-Z\\d]).+',
        tooltip: 'Try a different password.',
        autocomplete: 'current-password',
        class: 'password',
        button,
        ...(options || {})
    });
    const input = element.children[0] as HTMLInputElement;
    button.addEventListener('click', event => {
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    return element;
}

export function Checkbox(options: templateOptions, label: string) {
    const checkbox = <input type='checkbox' id={options.id} />;
    return (
        <label class='checkbox' for={options.id}>
            {checkbox} {label}
        </label>
    );
}

export function SegmentedSelect(options: { name: string, options: Record<string, [string, string]> }) {
    return (
        <div class='segmented-select'>
            {Object.keys(options.options).map(key => {
                const [ label, id ] = options.options[key];
                return <label for={id}><input type='radio' id={id} name={options.name} value={key} /> {label}</label>;
            })}
        </div>
    );
}

export function TopNav() {
    return (
        <div class='topnav'></div>
    );
}