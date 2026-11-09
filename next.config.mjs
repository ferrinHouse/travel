/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // sharp loads libvips from its @img/* platform package at runtime, which the
  // output tracer can't follow; without this, photo uploads fail in the image.
  outputFileTracingIncludes: {
    '/api/photos': ['./node_modules/@img/**/*'],
  },
};

export default nextConfig;
