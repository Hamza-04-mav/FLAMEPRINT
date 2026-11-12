import type { NextConfig } from "next";

const API = process.env.FLAMEPRINT_API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Proxy /api/* to FastAPI so the browser talks to a single origin (no CORS, works behind one URL).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
  // SSE streams must not be compressed/buffered by the dev proxy
  compress: false,
};

export default nextConfig;
