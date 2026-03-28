/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f8ff",
          100: "#dbeffd",
          500: "#0d6efd",
          700: "#0b59d0",
          900: "#093b8a"
        }
      }
    }
  },
  plugins: []
};
