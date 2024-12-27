/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't attempt to load better-sqlite3 and node native modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "better-sqlite3": false,
        "fs": false,
        "path": false,
        "net": false,
      };
    }
    return config;
  },
  // 启用服务器外部包支持
  serverExternalPackages: ['better-sqlite3'],
};

module.exports = nextConfig;
