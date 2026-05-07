import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium', 'pngjs', 'pixelmatch'],
  transpilePackages: [
    '@codemirror/language',
    '@lezer/highlight',
    '@lezer/common',
    '@lezer/lr',
  ],
};

export default nextConfig;
