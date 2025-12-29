import { post, TopNav } from './global.tsx';
import { h, Fragment } from './dom.ts';

function Task() {
    return (
        <div></div>
    );
}

function App() {
    return <>
        <TopNav />
        <div class='todo'></div>
    </>;
}

document.body.append(App());