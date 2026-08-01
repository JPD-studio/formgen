import type { NextConfig } from "next";

// Cloudflare Pages serves this as a static export (no Node.js server),
// so `headers()` isn't available here — see public/_headers for the
// equivalent sw.js caching rules.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
