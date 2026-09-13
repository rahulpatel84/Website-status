/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Keep Playwright + its native chromium runtime out of the webpack bundle.
    serverComponentsExternalPackages: [
      "playwright",
      "playwright-core",
      "chromium-bidi",
      "archiver",
    ],
  },
}

export default nextConfig