import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.zaitxmedia.com',
          },
        ],
        destination: 'https://zaitxmedia.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    const corsHeaders = [
      { key: "Access-Control-Allow-Origin", value: "https://admin.zaitxmedia.com" },
      { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
      { key: "Access-Control-Max-Age", value: "86400" },
    ];
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      // Allow admin subdomain to call API routes on main domain
      { source: "/api/admin/:path*", headers: corsHeaders },
      { source: "/api/recharges/:path*", headers: corsHeaders },
    ];
  },
};

export default nextConfig;
