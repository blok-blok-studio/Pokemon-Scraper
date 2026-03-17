import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#4ade80',
        surface: {
          DEFAULT: '#1a1a2e',
          secondary: '#16213e',
          tertiary: '#0f3460',
        }
      }
    }
  },
  plugins: []
}
export default config
