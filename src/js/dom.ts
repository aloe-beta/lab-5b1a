declare global {
    namespace JSX {
        interface Element extends HTMLElement {}

        interface IntrinsicElements {
            [elmtName: string]: any;
        }
    }
}

export function h(tag: string | ((props: any, ...children: any[]) => any), props: any, ...children: any[]) {
    if (typeof tag === 'function') {
        return tag(props, ...children);
    }

    const element = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
        element.setAttribute(key, value as string);
    });

    children.flat().forEach(child => {
        if (!child) return;
        element.appendChild(child instanceof Node ? child : document.createTextNode(child));
    });
    return element;
}

export const Fragment = (props: any, ...children: any) => {
    const fragment = document.createDocumentFragment();
    children.flat().forEach((child: any) => {
        if (!child) return;
        fragment.appendChild(child instanceof Node ? child : document.createTextNode(child));
    });
    return fragment;
};