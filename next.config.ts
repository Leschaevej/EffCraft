import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    devIndicators: false,
    eslint: {
        ignoreDuringBuilds: true
    },
    typescript: {
        ignoreBuildErrors: true
    },
    onDemandEntries: {
        maxInactiveAge: 25 * 1000,
        pagesBufferLength: 2,
    },
    experimental: {
        optimizeCss: false,
    },
    skipTrailingSlashRedirect: true
};
export default nextConfig;