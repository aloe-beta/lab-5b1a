import { TopNav } from './global.tsx';
import { h, Fragment } from './dom.ts';
import { authenticate } from './crypto.ts';

const {dek, username, sessionId} = authenticate();
if (dek === undefined || username === undefined || sessionId === undefined) {
    window.location.href = '/login';
}

function App() {
    return (<>
        <TopNav />
    </>);
}

document.body.append(App());