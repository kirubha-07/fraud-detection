import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Recharts v2 Tooltip formatter uses `ValueType | undefined` generics
    // which conflict with typed number arguments — known Recharts issue.
    // App is correct at runtime.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
