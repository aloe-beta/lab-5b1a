import { TopNav } from './global.tsx';
import { h, Fragment } from './dom.ts';
import { authenticate } from './crypto.ts';

const key = authenticate();
if (key === null) {
    window.location.href = '/login';
}

function App() {
    return (<>
        <TopNav />
    </>);
}

document.body.append(App());