// @ts-check
import withSerwistInit from "@serwist/next";
import { createRequire } from "module";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-generate build info if it doesn't exist or during build time
try {
  execSync("node scripts/generate-build-info.js", { cwd: __dirname, stdio: "inherit" });
} catch (e) {
  console.warn("Failed to generate build info:", e);
}

const withSerwist = withSerwistInit({
  cacheOnNavigation: false,
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: false,
});

// Set to your repository name (e.g. '/AmazeCC') if deploying to <username>.github.io/<repo-name>
// Keep empty '' if deploying to a custom domain (like amazecc.com) or a root user/org page.
const basePath = '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: basePath,
  trailingSlash: true,
  allowedDevOrigins: ['192.168.1.101', 'localhost:3001', '192.168.1.101:3001'],
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  transpilePackages: ['@amazecontinuityprojects/amazeui'],
  reactStrictMode: true,
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    unoptimized: true
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("@napi-rs/canvas");
    }
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native$': require.resolve('react-native-web'),
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withSerwist(nextConfig);
