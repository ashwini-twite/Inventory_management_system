import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    https: true,     // 🔥 IMPORTANT — required for camera on phone
    host: true,      // 🔥 So phone can access your laptop
    port: 5173        // keep your port
  }
});
