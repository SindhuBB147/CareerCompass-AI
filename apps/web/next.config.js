/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ESLint only just got a working config in this codebase (see
    // .eslintrc.json) and surfaced ~30 pre-existing violations across the
    // app (mostly react/no-unescaped-entities). Keep the production build
    // decoupled from lint — matching how it already behaved before ESLint
    // was configured at all — until those are cleaned up separately.
    // `npm run lint` still runs ESLint on demand.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const apiDevUrl = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/:path*`
      : 'http://localhost:3000/api/v1/:path*';
    return [
      {
        source: '/api/v1/:path*',
        destination: apiDevUrl,
      },
    ];
  },
};

module.exports = nextConfig;
