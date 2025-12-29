declare global {
    namespace JSX {
        interface Element extends HTMLElement {}

        interface IntrinsicElements {
            [elmtName: string]: any;
        }
    }
}