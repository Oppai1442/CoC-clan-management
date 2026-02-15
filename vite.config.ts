import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/CoC-clan-management/', // Tên repository của cậu phải nằm giữa 2 dấu gạch chéo
})
