import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        viteSingleFile({ removeViteModuleLoader: true }),
    ],
    build: {
        target: 'esnext',
        assetsInlineLimit: 100000000,
        cssCodeSplit: false,
        sourcemap: false,
    },
})
