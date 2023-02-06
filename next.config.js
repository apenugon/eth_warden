/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { defaultLoaders}) {
    config.resolve.fallback = { fs: false, path: false}
    config.experiments = { asyncWebAssembly: true }
    config.module.rules.push({
      test: /\prove_decryption.wasm$/,
      type: 'asset/resource',
    });
    return config
  },
}

module.exports = nextConfig
