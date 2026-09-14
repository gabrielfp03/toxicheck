import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** Configuración plana de ESLint 9 (sin `.eslintrc`). */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "out/**", "node_modules/**", "public/sw.js"],
  },
];

export default config;
