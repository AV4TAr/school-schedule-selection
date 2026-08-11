import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module: it must stay a real require() on the
  // server rather than being traced into the bundle.
  serverExternalPackages: ["better-sqlite3"],

  // Next.js blocks cross-origin requests to dev-only resources by default.
  // Browser automation tools commonly reach the dev server as 127.0.0.1 while
  // it thinks of itself as localhost, and a phone/laptop on the LAN reaches it
  // by its network IP — either trips this guard and silently breaks
  // hydration: chunks 403, the HMR websocket fails, and every click handler on
  // the page looks dead, with no error pointing at the real cause. Harmless in
  // production (`next start`): this config key does not exist there, and
  // `npm run dev` is never how the school actually runs the app day to day.
  allowedDevOrigins: ["127.0.0.1", "localhost", "diego.local", "192.168.86.45"],
};

export default nextConfig;
