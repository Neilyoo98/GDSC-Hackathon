/** @type {import('next').NextConfig} */
const DEFAULT_BACKEND_URL = "https://gdsc-hackathon-production.up.railway.app";
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  DEFAULT_BACKEND_URL;

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["react-markdown", "remark-gfm"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" }
    ]
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
