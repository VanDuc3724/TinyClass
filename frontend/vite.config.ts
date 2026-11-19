import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// https://vite.dev/config/
const proxy = {
  "/api": {
    target: process.env.TINYCLASS_API_PROXY_TARGET || "http://127.0.0.1:8080",
    changeOrigin: true,
  },
};

/**
 * The app renders text only after its JavaScript runs, so the browser would discover the
 * Nunito files late and swap fonts on screen. Preloading the two subsets every Vietnamese page
 * uses starts both downloads while the HTML is parsed. Fonts load in CORS mode, so the preload
 * needs `crossorigin` for the browser to reuse it.
 */
function preloadFonts(files: string[]): Plugin {
  let base = "/";
  return {
    name: "tinyclass-preload-fonts",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        return Object.values(context.bundle ?? {})
          .filter(
            (output) =>
              output.type === "asset" &&
              output.originalFileNames.some((name) =>
                files.some((file) => name.endsWith(`/${file}`)),
              ),
          )
          .map((asset) => ({
            tag: "link",
            attrs: {
              rel: "preload",
              href: `${base}${asset.fileName}`,
              as: "font",
              type: "font/woff2",
              crossorigin: true,
            },
            injectTo: "head" as const,
          }));
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    preloadFonts(["nunito-latin.woff2", "nunito-vietnamese.woff2"]),
  ],
  server: { proxy },
  preview: { proxy },
});
