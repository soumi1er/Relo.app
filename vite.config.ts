import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base relative ("./") : indispensable pour qu'Electron charge les fichiers
// une fois l'app packagée (file:// et non http://).
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5173, host: "0.0.0.0", allowedHosts: true },
  build: { outDir: "dist" },
});
