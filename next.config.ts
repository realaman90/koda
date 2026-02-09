import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude native Node.js modules from webpack bundling
  // better-sqlite3 is a native module that must be loaded at runtime
  serverExternalPackages: ['better-sqlite3'],

  // Produce a self-contained build in .next/standalone for Docker deployments
  output: 'standalone',
};

export default nextConfig;
