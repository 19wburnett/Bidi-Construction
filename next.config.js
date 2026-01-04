/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.bidicontracting.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  skipTrailingSlashRedirect: true,
  // Mark native modules as external to prevent bundling issues
  serverExternalPackages: ['@napi-rs/canvas', 'canvas'],
  // For older Next.js versions, also use experimental config
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'canvas'],
  },
}

module.exports = nextConfig
