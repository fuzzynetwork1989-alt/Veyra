/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@veyra/ui", "@veyra/sdk"],
};

module.exports = nextConfig;
