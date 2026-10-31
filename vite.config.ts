import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    optimizeDeps: {
      include: [
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "firebase/messaging",
      ],
    },
    server: {
      hmr: false,
      watch: process.env.DISABLE_HMR === "true" ? null : undefined,
    },
  };
});
