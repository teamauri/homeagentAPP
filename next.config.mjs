/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // The self-hosted ffmpeg.wasm runtime (the core is ~32MB). By default
        // Vercel serves public/ assets as `max-age=0, must-revalidate`, so the
        // browser re-pulls 32MB on every Auri Cut. These files are immutable, so
        // cache them hard — slow download once, instant on every later run.
        source: "/ffmpeg/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
