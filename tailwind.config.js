/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mph: {
          navy:     '#002850',  // MPH United logo navy
          navyDark: '#001E46',  // darker shade for hover states
          navyLight:'#0A3870',  // lighter shade for focus rings
          amber:    '#DCB41E',  // MPH United logo gold
          amberLight:'#E6C44A',// lighter gold for hover states
          gray:     '#f1f5f9',
        },
      },
    },
  },
  plugins: [],
}
