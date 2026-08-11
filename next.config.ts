import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module: it must stay a real require() on the
  // server rather than being traced into the bundle.
  serverExternalPackages: ["better-sqlite3"],

  // Next.js blocks cross-origin requests to dev-only resources by default.
  // Browser automation tools (agent-browser, Playwright, etc.) commonly reach
  // the dev server as 127.0.0.1 while it thinks of itself as localhost, which
  // trips that guard and silently breaks hydration — chunks 403, React never
  // attaches, and every click handler on the page looks dead. Harmless in
  // production: this config key does not exist there.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
