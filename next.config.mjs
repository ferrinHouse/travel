/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // sharp loads libvips from its @img/* platform package at runtime, which the
  // output tracer can't follow; without this, photo uploads fail in the image.
  outputFileTracingIncludes: {
    '/api/photos': ['./node_modules/@img/**/*'],
  },
  async headers() {
    const worker = [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      // Browsers check for a new worker on every visit; never serve a stale one.
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
    ];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
      { source: '/sw.js', headers: worker },
      { source: '/sw-core.js', headers: worker },
    ];
  },
};

export default nextConfig;
