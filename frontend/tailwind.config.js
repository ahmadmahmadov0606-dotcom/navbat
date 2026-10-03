const COLOR_NAMES = ["on-primary-container", "inverse-on-surface", "tertiary", "on-tertiary-fixed-variant", "surface-bright", "on-error-container", "error", "surface-dim", "surface-tint", "outline-variant", "inverse-surface", "surface-container-low", "surface-variant", "tertiary-fixed", "on-secondary", "surface-container-high", "on-secondary-container", "primary", "surface-container-lowest", "on-tertiary-container", "on-primary-fixed", "primary-fixed-dim", "surface-container-highest", "on-surface", "surface-container", "on-tertiary-fixed", "background", "secondary", "on-secondary-fixed", "secondary-fixed", "outline", "primary-fixed", "error-container", "secondary-fixed-dim", "on-surface-variant", "surface", "on-tertiary", "on-background", "primary-container", "tertiary-container", "inverse-primary", "on-secondary-fixed-variant", "on-primary-fixed-variant", "tertiary-fixed-dim", "on-error", "secondary-container", "on-primary"];
const INTER = ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'];
const JAKARTA = ['Plus Jakarta Sans', ...INTER];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}', '../myapp/management/commands/seed.py'],

  safelist: [{ pattern: /^(from|via|to)-(primary|secondary|tertiary)(-container|-fixed|-fixed-dim)?$/ }],
  theme: {
    extend: {
      colors: Object.fromEntries(COLOR_NAMES.map((n) => [n, `rgb(var(--c-${n}) / <alpha-value>)`])),
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', full: '9999px' },
      spacing: {
        gutter: '1.5rem', 'space-md': '1rem', 'space-lg': '1.5rem', 'gutter-mobile': '1rem', 'margin-mobile': '1.25rem',
        'space-xl': '2rem', margin: '2.5rem', 'space-sm': '0.5rem', 'space-xs': '0.25rem',
      },
      fontFamily: {
        'title-md': JAKARTA, 'headline-lg': JAKARTA, 'body-lg': INTER,
        display: JAKARTA, 'headline-md': JAKARTA, 'body-sm': INTER,
        'headline-sm': JAKARTA, 'label-md': INTER, 'body-md': INTER, 'label-sm': INTER,
        'display-mobile': JAKARTA, 'headline-lg-mobile': JAKARTA, 'label-lg': INTER,
      },
      fontSize: {
        'title-md': ['18px', { lineHeight: '26px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'body-lg': ['16px', { lineHeight: '26px', letterSpacing: '-0.005em', fontWeight: '400' }],
        display: ['48px', { lineHeight: '56px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'body-sm': ['12px', { lineHeight: '18px', letterSpacing: '0.01em', fontWeight: '400' }],
        'headline-sm': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '700' }],
        'display-mobile': ['36px', { lineHeight: '44px', letterSpacing: '-0.025em', fontWeight: '800' }],
        'headline-lg-mobile': ['26px', { lineHeight: '34px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.01em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
