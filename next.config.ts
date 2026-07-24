import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "derlist.dpdns.org",
    "192.168.1.191",
    "localhost:3000",
  ],
};

export default nextConfig;