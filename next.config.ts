import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is disabled by default in Next.js 15
  reactStrictMode: false, // Temporarily disable for React-Leaflet v5 compatibility
};

export default nextConfig;
