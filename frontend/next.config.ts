import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Don't write an AGENTS.md into the project on every `next dev`.
  agentRules: false,
  output: "standalone",
};

export default nextConfig;
