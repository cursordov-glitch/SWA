/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Vercel build will not fail on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Vercel build will not fail on TypeScript errors
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
