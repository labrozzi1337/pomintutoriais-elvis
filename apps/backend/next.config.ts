import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const rootEnv = path.resolve(import.meta.dirname, "../..", ".env");
if (existsSync(rootEnv)) loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./dist/sandbox-worker.cjs"] },
  poweredByHeader: false,
  reactStrictMode: true
};

export default withWorkflow(nextConfig);

