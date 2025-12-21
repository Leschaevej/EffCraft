import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    devIndicators: false,
    typescript: {
        ignoreBuildErrors: true
    },
    serverExternalPackages: ['mongodb', 'mongoose'],
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