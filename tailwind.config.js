/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Exact palette from the screenshots
        sifra: {
          bg:     '#eef1f8',   // subtle lavender-white page background
          bgDeep: '#e6eaf5',   // slightly deeper for sections
          navy:   '#111638',   // very dark navy – main headings
          blue:   '#2f4de0',   // accent blue "Your Hustle." + buttons
          blueMid:'#3b5bdb',   // hover state
          text:   '#374151',   // body text
          muted:  '#6b7280',   // secondary text
          border: '#dde3f0',   // card / input borders
          pill:   '#eef0fa',   // pill background
          pillBorder: '#c7ccee',
        },
      },
      fontFamily: {
        sans:   ['Inter', 'system-ui', 'sans-serif'],
        script: ['"Pinyon Script"', 'cursive'],
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgb(17 22 56 / 0.07), 0 1px 2px -1px rgb(17 22 56 / 0.05)',
        'card-hover':'0 8px 24px -4px rgb(47 77 224 / 0.13)',
        soft:       '0 2px 12px 0 rgb(17 22 56 / 0.08)',
      },
      animation: {
        'fade-in':   'fadeIn 0.3s ease-in-out',
        'slide-up':  'slideUp 0.35s ease-out',
        'pulse-soft':'pulseSoft 2s infinite',
        'float':     'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.65' } },
        float:     { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      backgroundImage: {
        'sifra-gradient': 'linear-gradient(145deg, #f4f6fd 0%, #eaedfa 50%, #e6eaf5 100%)',
      },
    },
  },
  plugins: [],
}
