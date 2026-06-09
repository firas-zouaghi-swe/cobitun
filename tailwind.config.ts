import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        /* Tunis Re Brand Colors */
        'tunis-blue': {
          DEFAULT: '#2E5A9D',
          dark: '#1E3A6B',
          light: '#4A7EC4',
          pale: '#E8EFF8',
        },
        'tunis-orange': {
          DEFAULT: '#E5693A',
          dark: '#C44D20',
          light: '#F08B65',
          pale: '#FDEAE3',
        },
        'tunis-navy': {
          DEFAULT: '#1A1A2E',
          light: '#16213E',
          mid: '#0F3460',
        },
        'square-blue': {
          DEFAULT: '#3C68A9',
          start: '#456CAA',
          end: '#304879',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        montserrat: ['var(--font-montserrat)', 'Montserrat', 'sans-serif'],
        inter: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-tunis-navy': 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
        'gradient-tunis-blue': 'linear-gradient(135deg, #2E5A9D 0%, #4A7EC4 100%)',
        'gradient-tunis-orange': 'linear-gradient(135deg, #E5693A 0%, #F08B65 100%)',
        'gradient-tunis-square': 'linear-gradient(135deg, #456CAA 0%, #304879 100%)',
        'gradient-tunis-hero': 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
