/** @type {import('next').NextConfig} */

const prod = process.env.NODE_ENV === 'production'
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    dirs: ['utils', 'test', 'pages', 'scripts']
  },
  reactStrictMode: true,
  webpack(config, { defaultLoaders}) {
    config.resolve.fallback = { fs: false, path: false}
    config.experiments = { asyncWebAssembly: true, layers: true }
    config.module.rules.push({
      test: /\prove_decryption.wasm$/,
      type: 'asset/resource',
    });
    return config
  },
  assetPrefix: !debug ? 'https://anotherplanet-io.github.io/Next-React-Components/' : ''
}

module.exports = nextConfig
