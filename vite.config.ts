import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps it deployable to any static host / subpath (e.g. GitHub Pages)
export default defineConfig({ plugins: [react()], base: './' })
