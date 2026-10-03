import type { NextConfig } from "next";

/**
 * Static export: the command center ships as plain HTML/CSS/JS served from
 * SpaceFast's static hosting. Server-side work (PayPal spine, agent
 * orchestration, verification) runs in SpaceFast serverless functions
 * (functions/api/*) so the demo has no always-on server to babysit.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
