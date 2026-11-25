import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwind from "@tailwindcss/vite";
import { defineConfig } from "vite";

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const upstream = path("../../../.build/gaia-room/openplan3d/src/lib");
const shims = path("./shell-shims.mjs");

export default defineConfig(({ mode }) => ({
  base: "./",
  publicDir: false,
  plugins: [
    svelte(),
    tailwind(),
    {
      name: "gaia-editor-notices",
      generateBundle() {
        for (const [fileName, source] of [
          ["OPENPLAN3D-LICENSE", "./OPENPLAN3D-LICENSE"],
          ["TAILWIND-LICENSE", "./node_modules/tailwindcss/LICENSE"],
        ]) {
          this.emitFile({ type: "asset", fileName, source: readFileSync(path(source)) });
        }
      },
    },
  ],
  resolve: {
    alias: [
      { find: "$lib/stores/saveStatus", replacement: shims },
      { find: "$app/paths", replacement: shims },
      { find: "./textureFiles", replacement: shims },
      { find: "virtual:catalog-assets", replacement: shims },
      { find: "$lib", replacement: upstream },
    ],
    dedupe: ["svelte"],
  },
  server: { fs: { allow: [path("../../../..")] } },
  build: {
    target: "es2022",
    outDir: path(
      mode === "acceptance" ? "../../../.build/gaia-room/acceptance-runtime" : "../../ui"
    ),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/workshop.min.js",
        chunkFileNames: "assets/[name]-[hash].min.js",
        assetFileNames: "assets/[name].min[extname]",
      },
    },
    license: { fileName: "DEPENDENCY-LICENSES.md" },
  },
}));
