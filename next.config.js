/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't attempt to load better-sqlite3 on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "better-sqlite3": false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
