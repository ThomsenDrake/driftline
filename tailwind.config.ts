import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Custom mood colors for thought markers
        'mood-calm': '#10b981', // green
        'mood-intense': '#ef4444', // red
        'mood-dreamy': '#8b5cf6', // purple
        'mood-neutral': '#3b82f6', // blue
      },
      animation: {
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        ping: {
          '0%': {
            transform: 'scale(0.75)',
            opacity: '1',
          },
          '75%, 100%': {
            transform: 'scale(2)',
            opacity: '0',
          },
        },
        pulse: {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '.5',
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;