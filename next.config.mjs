/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["bullmq", "ioredis", "nodemailer"],
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
