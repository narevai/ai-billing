/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@ai-sdk/baseten',
    '@basetenlabs/performance-client',
  ],
};

export default nextConfig;
