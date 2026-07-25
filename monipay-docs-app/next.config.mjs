/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  transpilePackages: ['ogl'],
  experimental: {
    // Required for some MDX features if needed
  },
};

export default nextConfig;
