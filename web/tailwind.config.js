module.exports = {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{js,jsx}'],
  },
  theme: {
    extend: {
      colors: {
        ink: '#151922',
        muted: '#667085',
        brand: '#2563eb',
        brandDark: '#1d4ed8',
        paper: '#f7f9fc',
      },
      boxShadow: {
        panel: '0 18px 45px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
};
