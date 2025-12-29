import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
    root: 'src',
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:5080',
                changeOrigin: true
            }
        },

        https: {
            key: readFileSync('./ssl/server.key'),
            cert: readFileSync('./ssl/server.crt')
        },

        open: false
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    esbuild: {
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
        // jsxInject: ''
    },
    plugins: [
        {
            name: 'strip',
            transformIndexHtml: {
                order: 'pre',
                handler(html) {
                    return html.replace(/\n\s*/g, '');
                }
            }
        }
    ]
});