import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@codemirror/language',
    '@lezer/highlight',
    '@lezer/common',
    '@lezer/lr',
  ],
};

export default nextConfig;
