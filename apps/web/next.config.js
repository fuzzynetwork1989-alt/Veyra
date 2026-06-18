const path = require("path");

const isNativeBuild = process.env.NATIVE_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isNativeBuild ? "export" : "standalone",
  trailingSlash: isNativeBuild,
  images: {
    unoptimized: isNativeBuild,
  },
  experimental: isNativeBuild
    ? {}
    : {
        outputFileTracingRoot: path.join(__dirname, "../../"),
      },
  transpilePackages: ["@veyra/ui", "@veyra/sdk"],
};

module.exports = nextConfig;