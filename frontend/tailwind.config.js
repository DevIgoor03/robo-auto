/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Syne', 'Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
        },
        /* Dark (Cakto / dashboard) */
        sidebar: '#141A22',
        'sidebar-hover': '#1A222D',
        'sidebar-active': 'oklch(0.62 0.20 152 / 0.18)',
        canvas: '#f0f2f7',
        'canvas-dark': '#161C24',
      },
      boxShadow: {
        card:       '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'card-dark':'0 1px 3px rgba(0,0,0,0.4),  0 4px 16px rgba(0,0,0,0.25)',
        'card-hover':'0 2px 6px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
        modal:      '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        'modal-dark':'0 8px 48px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.3)',
        'glow-brand':'0 0 20px rgba(132,204,22,0.25)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,0.8)',
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':  'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        /* InviteBull (referência local invitebull/app/globals.css) */
        'invite-aurora-1': 'inviteAurora1 12s ease-in-out infinite',
        'invite-aurora-2': 'inviteAurora2 15s ease-in-out infinite',
        'invite-aurora-3': 'inviteAurora3 18s ease-in-out infinite',
        'invite-marquee':  'inviteMarquee 28s linear infinite',
        'invite-float-up': 'inviteFloatUp 0.7s ease-out both',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseDot:{ '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        inviteAurora1: {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)', opacity: '0.5' },
          '33%': { transform: 'translate(3%, -4%) scale(1.08)', opacity: '0.65' },
          '66%': { transform: 'translate(-2%, 3%) scale(0.95)', opacity: '0.45' },
        },
        inviteAurora2: {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)', opacity: '0.4' },
          '33%': { transform: 'translate(-4%, 3%) scale(1.05)', opacity: '0.55' },
          '66%': { transform: 'translate(3%, -2%) scale(1.1)', opacity: '0.35' },
        },
        inviteAurora3: {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)', opacity: '0.3' },
          '50%': { transform: 'translate(2%, -3%) scale(1.06)', opacity: '0.45' },
        },
        inviteMarquee: {
          '0%': { transform: 'translate3d(0, 0, 0)' },
          '100%': { transform: 'translate3d(-50%, 0, 0)' },
        },
        inviteFloatUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
