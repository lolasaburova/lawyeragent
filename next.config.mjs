/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse and mammoth are server-only libraries. We keep them external so
  // Next.js does not try to bundle them into the serverless function in a way
  // that breaks their internal file/asset loading.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
