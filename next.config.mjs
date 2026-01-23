/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude fsevents from webpack bundling (native module)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fsevents: false,
      };
    }

    // Mark fsevents as external to prevent bundling
    config.externals = [...(config.externals || []), 'fsevents'];

    return config;
  },
};

export default nextConfig;
