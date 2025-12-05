import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

let config = nextConfig;

if (process.env.NODE_ENV !== "development") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withPWA = require("@ducanh2912/next-pwa").default({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    workboxOptions: {
      disableDevLogs: true,
    },
  });
  config = withPWA(nextConfig);
}

export default config;
