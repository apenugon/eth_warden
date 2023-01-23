/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.fallback = { fs: false, path: false}
    config.experiments = { asyncWebAssembly: true }
    return config
  },
}

module.exports = nextConfig
