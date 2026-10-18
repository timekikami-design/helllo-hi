// lms-frontend/tailwind.config.js
// ------------------------------------------------------------------
// AUST ODL — design tokens (premium redesign).
//  1. Semantic, theme-switching tokens (canvas, surface, line, fg,
//     brand, brass, ok/warn/bad/note) backed by CSS variables in
//     src/index.css — light and dark designed separately there.
//  2. Legacy palette names used by the existing pages (slate, blue,
//     indigo, violet, emerald, rose …) are REMAPPED onto the restrained
//     AUST palette (warm neutrals, navy, brass, four status colours), so
//     every page inherits the new visual language without touching its
//     markup, routes, handlers, field names or data-testids.
//  Gradients flatten to their first stop, blur is off, radius and
//  elevation follow the D8 / D9 scales.
// ------------------------------------------------------------------
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const neutral = { 50: "#F3F2EE", 100: "#EEECE7", 200: "#DEDAD2", 300: "#C5BFB3", 400: "#8E939D", 500: "#646B7A", 600: "#444C5C", 700: "#333B4A", 800: "#273241", 900: "#161C24", 950: "#0F1419" };
const navy = { 50: "#EEF2F8", 100: "#E4EBF4", 200: "#C9D6E6", 300: "#8FB3DE", 400: "#7AA2D0", 500: "#3F6390", 600: "#1F3A5F", 700: "#172D4A", 800: "#0F2038", 900: "#0B192C", 950: "#07101E" };
const ink = { 50: "#F0F3F7", 100: "#E2E8F0", 200: "#C7D2E0", 300: "#A9BBD3", 400: "#8299BA", 500: "#56739A", 600: "#4D6E96", 700: "#3E5A7C", 800: "#2F4560", 900: "#223246", 950: "#1A2433" };
const brass = { 50: "#FAF5EA", 100: "#F4EBDA", 200: "#E8D5AE", 300: "#D4AE72", 400: "#C29A5E", 500: "#B8925A", 600: "#8A6A2E", 700: "#735824", 800: "#5A451C", 900: "#3D2F14", 950: "#2A2418" };
const success = { 50: "#EEF6F1", 100: "#E3F0E9", 200: "#C3DDCD", 300: "#7DC6A2", 400: "#4E9A75", 500: "#357F5C", 600: "#2C6B4D", 700: "#235A40", 800: "#1B4532", 900: "#143326", 950: "#15281F" };
const warning = { 50: "#FDF6E8", 100: "#FBF0D9", 200: "#F1DCAE", 300: "#E6B85C", 400: "#C9922B", 500: "#956309", 600: "#8A5B07", 700: "#734B06", 800: "#5A3B06", 900: "#3F2A07", 950: "#2B2312" };
const danger = { 50: "#FBF0EF", 100: "#F8E5E3", 200: "#EFC4C0", 300: "#EB8C84", 400: "#D0594F", 500: "#B93D35", 600: "#A23029", 700: "#872621", 800: "#6B1F1B", 900: "#4D1714", 950: "#301B19" };
const info = { 50: "#EEF4FA", 100: "#E3EDF7", 200: "#C3D7EC", 300: "#8DB9E8", 400: "#5E92C7", 500: "#3C72A6", 600: "#2B5C8A", 700: "#234C73", 800: "#1C3C5B", 900: "#152C43", 950: "#172637" };

const flat = "linear-gradient(var(--tw-gradient-from, transparent), var(--tw-gradient-from, transparent))";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: v("bg"),
        surface: { DEFAULT: v("surface"), elevated: v("surface-elevated"), muted: v("surface-muted"), sunken: v("surface-sunken") },
        line: { DEFAULT: v("border"), strong: v("border-strong") },
        fg: { DEFAULT: v("text-primary"), secondary: v("text-secondary"), muted: v("text-muted"), disabled: v("text-disabled") },
        brand: { DEFAULT: v("primary"), hover: v("primary-hover"), active: v("primary-active"), soft: v("primary-soft"), on: v("on-primary") },
        brass: { DEFAULT: v("accent"), decor: v("accent-decor"), soft: v("accent-soft") },
        ok: { DEFAULT: v("success"), soft: v("success-bg") },
        warn: { DEFAULT: v("warning"), soft: v("warning-bg") },
        bad: { DEFAULT: v("error"), soft: v("error-bg") },
        note: { DEFAULT: v("info"), soft: v("info-bg") },
        slate: neutral, gray: neutral, zinc: neutral, neutral, stone: neutral,
        primary: navy, blue: navy, indigo: navy, sky: info, cyan: info, teal: info,
        violet: ink, purple: ink, fuchsia: ink, pink: ink,
        accent: brass,
        emerald: success, green: success, lime: success,
        amber: warning, yellow: warning, orange: warning,
        rose: danger, red: danger,
      },
      fontFamily: {
        sans: ["'Instrument Sans'", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["'Instrument Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Newsreader", "Georgia", "'Times New Roman'", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        display: ["40px", { lineHeight: "44px", fontWeight: "400" }],
        "display-sm": ["32px", { lineHeight: "36px", fontWeight: "400" }],
        title: ["28px", { lineHeight: "34px", fontWeight: "600" }],
        heading: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        sub: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["15px", { lineHeight: "24px" }],
        label: ["12px", { lineHeight: "16px", letterSpacing: "0.06em", fontWeight: "500" }],
      },
      borderRadius: { none: "0", sm: "4px", DEFAULT: "4px", md: "6px", lg: "8px", xl: "8px", "2xl": "8px", "3xl": "12px", full: "9999px" },
      boxShadow: {
        none: "none", sm: "0 1px 2px rgba(15,20,25,0.06)", DEFAULT: "0 1px 2px rgba(15,20,25,0.06)",
        md: "0 1px 2px rgba(15,20,25,0.06)", lg: "0 1px 2px rgba(15,20,25,0.06)",
        xl: "0 8px 24px rgba(15,20,25,0.10)", "2xl": "0 8px 24px rgba(15,20,25,0.10)", inner: "none",
        soft: "0 1px 2px rgba(15,20,25,0.06)", glass: "0 1px 2px rgba(15,20,25,0.06)", glow: "none", pop: "0 8px 24px rgba(15,20,25,0.10)",
      },
      backdropBlur: { none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0" },
      backgroundImage: {
        "gradient-to-t": flat, "gradient-to-tr": flat, "gradient-to-r": flat, "gradient-to-br": flat,
        "gradient-to-b": flat, "gradient-to-bl": flat, "gradient-to-l": flat, "gradient-to-tl": flat,
        "gradient-radial": flat, "hero-pattern": "none",
      },
      height: { dvh: "100dvh" },
      minHeight: { dvh: "100dvh" },
      animation: { "fade-in": "aust-fade 400ms ease-out both", "slide-up": "aust-fade 400ms ease-out both", "pulse-slow": "pulse 3s ease-in-out infinite", float: "none" },
      keyframes: { "aust-fade": { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "none" } } },
    },
  },
  plugins: [],
};
