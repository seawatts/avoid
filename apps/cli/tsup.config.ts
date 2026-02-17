import * as fs from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default defineConfig({
  bundle: true,
  clean: true,
  define: {
    "process.env.AVOID_VERSION": JSON.stringify(pkg.version),
  },
  entry: ["src/cli.tsx"],
  esbuildOptions(options) {
    options.banner = {
      js: "#!/usr/bin/env bun",
    };
    options.jsx = "automatic";
    options.jsxImportSource = "@opentui/react";

    options.plugins = options.plugins || [];
    options.plugins.push({
      name: "externalize-bun-file-imports",
      setup(build) {
        build.onResolve({ filter: /\.(wasm|scm)$/ }, (args) => ({
          external: true,
          path: args.path,
        }));
      },
    });
  },
  external: [
    "bun:sqlite",
    "bun:ffi",
    "bun:jsc",
    "@opentui/core",
    "@opentui/react",
    "react",
    "react-reconciler",
    "react-devtools-core",
    "yoga-layout",
    "web-tree-sitter",
  ],
  format: ["esm"],
  minify: false,
  noExternal: [
    "@seawatts/ai",
    "@seawatts/analytics",
    "@seawatts/db",
    "@seawatts/id",
    "@seawatts/memory",
  ],
  onSuccess: async () => {
    const outFile = "./bin/cli.js";
    if (fs.existsSync(outFile)) {
      fs.chmodSync(outFile, 0o755);
      console.log(`Build complete: ${outFile}`);
    }
  },
  outDir: "bin",
  platform: "node",
  sourcemap: "inline",
  splitting: false,
  target: "node20",
  treeshake: true,
  tsconfig: "tsconfig.json",
});
