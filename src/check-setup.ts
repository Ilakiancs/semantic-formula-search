import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Checking F1 RAG AI Project Setup...\n');

// Check Node.js version
console.log(`Node.js version: ${process.version}`);

// Check required environment variables
const requiredEnvVars = [
  'ASTRA_DB_APPLICATION_TOKEN',
  'ASTRA_DB_ID',
  'ASTRA_DB_REGION',
  'ASTRA_DB_API_ENDPOINT'
];

let allEnvVarsSet = true;

requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value && value.trim() !== '') {
    console.log(`${envVar}: Set`);
  } else {
    console.log(`${envVar}: Not set or empty`);
    allEnvVarsSet = false;
  }
});

// Check AWS configuration
console.log('\nAWS Configuration:');
console.log('AWS Region: ap-southeast-1 (Singapore)');
console.log('AWS Bedrock Embedding Model: cohere.embed-english-v3');
console.log('AWS Bedrock Chat Model: amazon.nova-pro-v1:0');
console.log('Vector Dimensions: 1024');
console.log('Note: AWS credentials should be configured via AWS CLI profile or bearer token');

console.log('\nSetup Status:');
if (allEnvVarsSet) {
  console.log('✅ All environment variables are configured!');
  console.log('✅ AWS Bedrock will be used for embeddings AND chat completions');
  console.log('✅ Fully cloud-based RAG system with no external API dependencies');
  console.log('You can now run: npm run ingest');
} else {
  console.log('❌ Please set all environment variables in your .env file');
  console.log('Copy .env.example to .env and fill in your credentials');
}

console.log('\nNext steps:');
console.log('1. Ensure AWS CLI is configured with Bedrock access in ap-southeast-1');
console.log('2. Make sure your DataStax Astra DB is created and running');
console.log('3. Run: npm run ingest (to scrape and store data with Cohere embeddings)');
console.log('4. Run: npm run answer (to test the full Bedrock RAG application)');
console.log('\nAvailable chat models you can switch to:');
console.log('- amazon.nova-pro-v1:0 (current)');
console.log('- anthropic.claude-3-5-sonnet-20241022-v2:0');
console.log('- anthropic.claude-3-haiku-20240307-v1:0');
console.log('- amazon.nova-lite-v1:0');
