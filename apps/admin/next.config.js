/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@veyra/ui", "@veyra/sdk"],
};

module.exports = nextConfig;
