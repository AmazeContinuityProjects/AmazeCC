// @ts-check
import withSerwistInit from "@serwist/next";
import { withPostHogConfig } from "@posthog/nextjs-config";
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
  cacheOnNavigation: true,
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Set to your repository name (e.g. '/AmazeCC') if deploying to <username>.github.io/<repo-name>
// Keep empty '' if deploying to a custom domain (like amazecc.com) or a root user/org page.
const basePath = "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  output: "export",
  basePath: basePath,
  trailingSlash: true,
  allowedDevOrigins: ["192.168.1.101", "localhost:3001", "192.168.1.101:3001"],
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  transpilePackages: ["@amazecontinuityprojects/amazeui"],
  reactStrictMode: true,
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("@napi-rs/canvas");
    }
    // Docs/markdown, design assets and repo bookkeeping are not part of the
    // compile graph — tell the watcher to ignore them so editing docs doesn't
    // kick off (or spam) dev-server reloads.
    //
    // The framework config passes a RegExp as `watchOptions.ignored[0]`,
    // which webpack's schema validator in Next 16 rejects ("should be a
    // non-empty string"). Keep only entries the schema accepts — non-empty
    // strings and functions — and leave our own globs alone.
    const baseIgnored = config.watchOptions?.ignored ? [config.watchOptions.ignored].flat() : [];
    const safeBaseIgnored = baseIgnored.filter(
      (entry) => (typeof entry === "string" && entry.length > 0) || typeof entry === "function",
    );
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: [
        ...safeBaseIgnored,
        "**/docs/**",
        "**/grounding/**",
        "**/design/**",
        "**/data/**",
        "**/sql/**",
        "**/certificates/**",
        "**/dayscholar/**",
        "**/.github/**",
        "**/scripts/**",
        "**/*.md",
        "**/*.markdown",
      ],
    };
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": require.resolve("react-native-web"),
    };
    return config;
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withPostHogConfig(withSerwist(nextConfig), {
  personalApiKey: process.env.POSTHOG_API_KEY ?? "",
  projectId: process.env.POSTHOG_PROJECT_ID,
  host: process.env.POSTHOG_HOST,
  sourcemaps: {
    enabled: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID),
    deleteAfterUpload: true,
  },
});
