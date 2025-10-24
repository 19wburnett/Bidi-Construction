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
    ],
  },
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig
