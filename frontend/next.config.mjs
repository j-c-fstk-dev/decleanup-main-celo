/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Webpack configuration to handle MetaMask SDK warnings
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Resolve React Native async storage for browser (MetaMask SDK compatibility)
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
      };
    }
    return config;
  },
};

export default nextConfig;

