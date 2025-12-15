/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack options
  turbopack: {
    // Required: workspace root to silence lockfile warnings
    root: process.cwd(),
  },

  // Serve .well-known directory correctly
  async headers() {
    return [
      {
        source: "/.well-known/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

