import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      // 1200px - ширина контента опорного стиля. Ленты уходят за нее
      // в края экрана, содержимое остается внутри.
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Фирменные цвета лент. Зеленый и голубой - только фоны:
        // заливкой кнопок они не бывают никогда.
        forest: 'hsl(var(--brand-forest))',
        sky: 'hsl(var(--brand-sky))',
        cream: 'hsl(var(--brand-cream))',
        ink: 'hsl(var(--brand-ink))',
        plum: 'hsl(var(--brand-plum))',
        graphite: 'hsl(var(--brand-graphite))',
        char: 'hsl(var(--brand-char))',
        fog: 'hsl(var(--brand-fog))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Кнопка-таблетка: 60px по всей системе, без исключений.
        pill: '60px',
        // Крупные карточки-подложки под макеты и превью.
        card: '48px',
      },
      boxShadow: {
        pill: '0 4px 20px 0 rgba(0, 0, 0, 0.18)',
        lift: '0 4px 20px 0 rgba(0, 0, 0, 0.14)',
        cover: '0 2px 8px 0 rgba(0, 0, 0, 0.2)',
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
