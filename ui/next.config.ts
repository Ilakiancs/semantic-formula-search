import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    BEDROCK_EMBEDDING_MODEL: process.env.BEDROCK_EMBEDDING_MODEL,
    BEDROCK_CHAT_MODEL: process.env.BEDROCK_CHAT_MODEL,
    USE_BEDROCK_CHAT: process.env.USE_BEDROCK_CHAT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
  experimental: {
    serverComponentsExternalPackages: ["@aws-sdk/client-bedrock-runtime"],
  },
};

export default nextConfig;
