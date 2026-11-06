import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import { fontFamily } from "tailwindcss/defaultTheme";

// Tokens de DESIGN.md §2 y UI-styloapp.md §3. Las variables viven en globals.css, con su valor de día y
// de noche (Fase 16): ninguna pantalla lleva clases `dark:`.

/** Un color de globals.css en RGB, que sigue sirviendo con opacidad (`bg-surface/80`). */
function rgb(variable: string): string {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  // Solo para lo que quede suelto: los colores ya cambian solos con el modo del sistema.
  darkMode: "media",
  theme: {
    // Los colores de sombra son los mismos de la paleta, menos `card`: si no, `shadow-card` (la sombra de
    // abajo) también es "sombra del color de la tarjeta", esa gana y la sombra sale casi invisible.
    boxShadowColor: ({ theme }) => {
      const colors = { ...theme("colors") };
      delete colors.card;
      return colors;
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: rgb("--primary-50"),
          100: rgb("--primary-100"),
          200: rgb("--primary-200"),
          300: rgb("--primary-300"),
          400: rgb("--primary-400"),
          500: rgb("--primary-500"),
          600: rgb("--primary-600"),
          700: rgb("--primary-700"),
          800: rgb("--primary-800"),
          900: rgb("--primary-900"),
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Nombres propios de StyloApp.
        tertiary: rgb("--tertiary"),
        ink: rgb("--ink"),
        slate: rgb("--slate"),
        stroke: rgb("--stroke"),
        line: rgb("--line"),
        canvas: rgb("--canvas"),
        surface: rgb("--surface"),
        soft: rgb("--soft"),
        // El velo detrás de ventanas y hojas: petróleo profundo de día, negro de noche.
        overlay: "hsl(var(--overlay) / <alpha-value>)",
        success: "hsl(var(--success))",
        danger: "hsl(var(--destructive))",
        warning: "hsl(var(--warning))",
      },
      // De día el texto y el anillo "secondary" son el mismo petróleo profundo del fondo; de noche el fondo
      // sigue oscuro (franjas y pastillas) y el texto y el anillo pasan a menta para leerse.
      textColor: {
        secondary: {
          DEFAULT: "hsl(var(--secondary-text) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
      },
      ringColor: {
        secondary: "hsl(var(--secondary-text) / <alpha-value>)",
      },
      // `ring-offset-2` deja un hueco del color de la tarjeta: blanco de día (el de Tailwind), oscuro de noche.
      ringOffsetColor: {
        DEFAULT: "rgb(var(--ring-offset))",
      },
      fontFamily: {
        sans: ["var(--font-quicksand)", ...fontFamily.sans],
      },
      // Escala fija de tamaños (sin tamaños fluidos).
      fontSize: {
        10: ["10px", "14px"],
        11: ["11px", "15px"],
        12: ["12px", "16px"],
        13: ["13px", "18px"],
        14: ["14px", "20px"],
        15: ["15px", "21px"],
        16: ["16px", "22px"],
        17: ["17px", "24px"],
        18: ["18px", "25px"],
        20: ["20px", "26px"],
        22: ["22px", "28px"],
        25: ["25px", "32px"],
        30: ["30px", "38px"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "8px",
        sm: "6px",
        card: "10px",
        booking: "6px",
        sheet: "20px",
        header: "25px",
      },
      boxShadow: {
        card: "0 2px 6px rgb(var(--shadow) / 0.12)",
        "card-hover": "0 4px 12px rgb(var(--shadow) / 0.16)",
        // La sombra de arriba de las hojas que suben desde abajo (editor de la cita y catálogo).
        sheet: "0 -4px 16px rgb(var(--shadow) / 0.16)",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
      // Tiempos de DESIGN.md con nombre: `duration-[120ms]` choca con tailwindcss-animate (las dos
      // usan `duration-`) y Tailwind no genera nada. Con nombre salen las dos: transición y animación.
      transitionDuration: {
        120: "120ms",
        180: "180ms",
        220: "220ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
