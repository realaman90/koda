import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude native Node.js modules from webpack bundling
  // better-sqlite3 is a native module that must be loaded at runtime
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
