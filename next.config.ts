import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server (`next dev`) blocks cross-origin requests to its internal
  // `/_next/*` assets and HMR endpoints by default — it only trusts the origin
  // it was initialized on (localhost). When the app is reached through the
  // Cloudflare tunnel (mission.wynneops.com) the browser is a *different*
  // origin, so the JS chunks get refused and the page never hydrates (dead
  // buttons, zeroed stats, empty constellation, missing top bar). Allowlist the
  // tunnel host so dev assets load identically via localhost or the tunnel.
  // (Dev-only — a production `next start` build serves static assets with no
  // such check.)
  allowedDevOrigins: ["mission.wynneops.com", "*.wynneops.com"],
};

export default nextConfig;
