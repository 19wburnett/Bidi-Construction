/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'www.bidicontracting.com'],
  },
  skipTrailingSlashRedirect: true,
  // Disable automatic router refresh on window focus
  experimental: {
    windowHistorySupport: true,
  },
}

module.exports = nextConfig
