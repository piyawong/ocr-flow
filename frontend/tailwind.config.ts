import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
  	extend: {
  		colors: {
  			'bg-primary': 'var(--bg-primary)',
  			'bg-secondary': 'var(--bg-secondary)',
  			'card-bg': 'var(--card-bg)',
  			'nav-bg': 'var(--nav-bg)',
  			'text-primary': 'var(--text-primary)',
  			'text-secondary': 'var(--text-secondary)',
  			'text-muted': 'var(--text-muted)',
  			'border-color': 'var(--border-color)',
  			'divider-color': 'var(--divider-color)',
  			'hover-bg': 'var(--hover-bg)',
  			'active-bg': 'var(--active-bg)',
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			'accent-light': 'var(--accent-light)',
  			'accent-dark': 'var(--accent-dark)',
  			success: 'var(--success)',
  			'success-light': 'var(--success-light)',
  			warning: 'var(--warning)',
  			'warning-light': 'var(--warning-light)',
  			danger: 'var(--danger)',
  			'danger-light': 'var(--danger-light)',
  			info: 'var(--info)',
  			'info-light': 'var(--info-light)',
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
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
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
  		fontFamily: {
  			sans: [
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'"Segoe UI"',
  				'Roboto',
  				'Oxygen',
  				'Ubuntu',
  				'sans-serif'
  			],
  			mono: [
  				'"SF Mono"',
  				'Monaco',
  				'Inconsolata',
  				'"Fira Mono"',
  				'monospace'
  			]
  		},
  		boxShadow: {
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)'
  		},
  		borderRadius: {
  			sm: 'calc(var(--radius) - 4px)',
  			md: 'calc(var(--radius) - 2px)',
  			lg: 'var(--radius)',
  			xl: 'var(--radius-xl)',
  			'2xl': 'var(--radius-2xl)'
  		},
  		spacing: {
  			xs: 'var(--space-xs)',
  			sm: 'var(--space-sm)',
  			md: 'var(--space-md)',
  			lg: 'var(--space-lg)',
  			xl: 'var(--space-xl)',
  			'2xl': 'var(--space-2xl)'
  		},
  		transitionDuration: {
  			fast: '150ms',
  			normal: '200ms',
  			slow: '300ms'
  		},
  		keyframes: {
  			pulse: {
  				'0%, 100%': {
  					opacity: '1',
  					transform: 'scale(1)'
  				},
  				'50%': {
  					opacity: '0.5',
  					transform: 'scale(1.2)'
  				}
  			},
  			infinityGlow: {
  				'0%, 100%': {
  					boxShadow: '0 0 5px rgba(123, 97, 255, 0.3)'
  				},
  				'50%': {
  					boxShadow: '0 0 15px rgba(123, 97, 255, 0.6)'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			}
  		},
  		animation: {
  			'pulse-slow': 'pulse 3s ease-in-out infinite',
  			'infinity-glow': 'infinityGlow 2s ease-in-out infinite',
  			shimmer: 'shimmer 2s linear infinite'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
