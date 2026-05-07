import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium', 'pngjs', 'pixelmatch'],
  outputFileTracingIncludes: {
    '/api/visual-compare': ['./node_modules/@sparticuz/chromium/**/*'],
  },
  transpilePackages: [
    '@codemirror/language',
    '@lezer/highlight',
    '@lezer/common',
    '@lezer/lr',
  ],
};

export default nextConfig;
