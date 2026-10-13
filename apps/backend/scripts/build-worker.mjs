import { build } from "esbuild";

await build({
  entryPoints: ["src/sandbox-worker.ts"], outfile: "dist/sandbox-worker.cjs",
  bundle: true, platform: "node", target: "node24", format: "cjs",
  external: ["msgpackr-extract"], logLevel: "info"
});
