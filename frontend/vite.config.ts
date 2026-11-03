import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
const proxy = {
  "/api": {
    target: process.env.TINYCLASS_API_PROXY_TARGET || "http://127.0.0.1:8080",
    changeOrigin: true,
  },
};
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
