import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  plugins: [
    {
      name: "homepage-development-entry",
      apply: "serve",
      transformIndexHtml(html, context) {
        return context.path === "/" || context.path === "/index.html"
          ? html.replace("./assets/home-built/home.js", "/src/home.mjs")
          : html;
      },
    },
  ],
  build: {
    outDir: "assets/home-built",
    emptyOutDir: true,
    target: "es2022",
    lib: { entry: "src/home.mjs", formats: ["es"], fileName: () => "home.js" },
    rollupOptions: { output: { chunkFileNames: "[name]-[hash].js" } },
  },
});
