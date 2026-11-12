import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "exclude-aistudio-chat-media",
        closeBundle() {
          const chatMediaDir = path.resolve(__dirname, "dist/assets/aistudio");
          if (fs.existsSync(chatMediaDir)) {
            fs.rmSync(chatMediaDir, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    define: {
      "import.meta.env.VITE_GOOGLE_MAPS_API_KEY": JSON.stringify(
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
          process.env.GOOGLE_MAPS_API_KEY ||
          "AIzaSyBsEZaLW1kpzMu2QP-T8IrdmkZqiM3gfe8"
      ),
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
