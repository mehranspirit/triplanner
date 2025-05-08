/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#f0f9ff',
  				'100': '#e0f2fe',
  				'200': '#bae6fd',
  				'300': '#7dd3fc',
  				'400': '#38bdf8',
  				'500': '#0ea5e9',
  				'600': '#0284c7',
  				'700': '#0369a1',
  				'800': '#075985',
  				'900': '#0c4a6e',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		animation: {
  			'spin-slow': 'spin 3s linear infinite',
  			'orbit': 'orbit 3s linear infinite',
  			float: 'float 3s ease-in-out infinite',
  			'fly': 'fly 3s ease-in-out infinite',
  			'moveRight': 'moveRight 4s ease-in-out infinite',
  			'moveLeft': 'moveLeft 5s ease-in-out infinite',
  			'bounce': 'bounce 2s ease-in-out infinite',
  			'pulse': 'pulse 2s ease-in-out infinite',
  			'fade-out': 'fade-out 0.3s ease-out forwards',
  			'pulse-glow': 'pulse-glow 2s ease-in-out infinite'
  		},
  		keyframes: {
  			orbit: {
  				'0%': {
  					transform: 'rotate(0deg) translateX(80px) rotate(0deg)'
  				},
  				'100%': {
  					transform: 'rotate(360deg) translateX(80px) rotate(-360deg)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-10px)'
  				}
  			},
  			fly: {
  				'0%, 100%': { transform: 'translate(-50%, -50%) rotate(-45deg)' },
  				'50%': { transform: 'translate(50%, 50%) rotate(-45deg)' }
  			},
  			moveRight: {
  				'0%': { transform: 'translateX(-100%)' },
  				'100%': { transform: 'translateX(100%)' }
  			},
  			moveLeft: {
  				'0%': { transform: 'translateX(100%)' },
  				'100%': { transform: 'translateX(-100%)' }
  			},
  			bounce: {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-20px)' }
  			},
  			pulse: {
  				'0%, 100%': { transform: 'scale(1)' },
  				'50%': { transform: 'scale(1.2)' }
  			},
  			'fade-out': {
  				'from': {
  					opacity: '1',
  					transform: 'translateX(0)'
  				},
  				'to': {
  					opacity: '0',
  					transform: 'translateX(-20px)'
  				}
  			},
  			'pulse-glow': {
  				'0%, 100%': { 
  					opacity: '0',
  					boxShadow: '0 0 12px 12px rgba(0, 0, 0, 0), 0 0 4px 8px rgba(0, 0, 0, 0)'
  				},
  				'50%': { 
  					opacity: '1',
  					boxShadow: '0 0 16px 16px var(--glow-color, rgba(234, 179, 8, 1)), 0 0 6px 10px var(--glow-color, rgba(234, 179, 8, 0.9))'
  				}
  			}
  		},
  		backgroundImage: {
  			'travel-collage': 'url("/images/travel-collage.jpg")'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} 