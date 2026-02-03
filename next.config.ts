import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io',
        port: '',
        pathname: '/**',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/image-editor/serve/**',
      },
    ],
  },
}

export default nextConfig
