import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    esbuild: {
        jsx: 'automatic',
    },
    optimizeDeps: {
        // driver.js is imported from a lazily-loaded page chunk, so Vite only
        // discovers it once that page is first visited — and re-optimising
        // mid-session is what produces "504 (Outdated Optimize Dep)" until the
        // dev server is restarted. Naming it here gets it pre-bundled on
        // startup instead.
        include: ['driver.js'],
    },
});
