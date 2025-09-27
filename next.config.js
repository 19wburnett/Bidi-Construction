/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'www.bidicontracting.com'],
  },
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig
