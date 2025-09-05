import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasAwsBearerToken: !!process.env.AWS_BEARER_TOKEN_BEDROCK,
    awsRegion: process.env.AWS_REGION,
    hasAstraToken: !!process.env.ASTRA_DB_APPLICATION_TOKEN,
    nodeEnv: process.env.NODE_ENV,
    // Don't expose actual token values for security
  });
}
