import { z } from "zod";
import { config } from "./lib/config";
import { getDatabase } from "./lib/db";
import { generateEmbedding, generateResponse } from "./lib/openai";
import { validateF1Document, F1Document } from "./lib/schemas";

// Test result schema
const TestResultSchema = z.object({
  name: z.string(),
  status: z.enum(["pass", "fail", "skip"]),
  message: z.string(),
  duration: z.number(),
  error: z.string().optional(),
});

type TestResult = z.infer<typeof TestResultSchema>;

class F1SystemTester {
  private results: TestResult[] = [];

  private async runTest(
    name: string,
    testFn: () => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`🧪 Testing: ${name}`);
      await testFn();

      const duration = Date.now() - startTime;
      this.results.push({
        name,
        status: "pass",
        message: "Test passed successfully",
        duration,
      });
      console.log(`   ✅ Passed (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.results.push({
        name,
        status: "fail",
        message: "Test failed",
        duration,
        error: errorMsg,
      });
      console.log(`   ❌ Failed: ${errorMsg} (${duration}ms)`);
    }
  }

  // Test environment configuration
  async testConfiguration(): Promise<void> {
    await this.runTest("Environment Configuration", async () => {
      // Test that config is loaded and validated
      if (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY) {
        throw new Error("AWS credentials not configured");
      }

      if (!config.SUPABASE_URL && !config.ASTRA_DB_APPLICATION_TOKEN) {
        throw new Error("No database configured");
      }

      console.log(`     AWS Region: ${config.AWS_REGION}`);
      console.log(`     Embedding Model: ${config.BEDROCK_EMBEDDING_MODEL}`);
      console.log(`     Chat Model: ${config.BEDROCK_CHAT_MODEL}`);
    });
  }

  // Test Zod schema validation
  async testSchemaValidation(): Promise<void> {
    await this.runTest("Zod Schema Validation", async () => {
      // Test valid F1 document
      const validDocument: F1Document = {
        text: "Max Verstappen is a Formula 1 driver racing for Red Bull Racing in the 2024 season.",
        embedding: new Array(1024).fill(0.1),
        source: "test_data.csv",
        category: "drivers",
        season: "2024",
        driver: "Max Verstappen",
        team: "Red Bull Racing",
        points: 575,
        position: 1,
        constructor: "Red Bull Racing Honda RBPT",
      };

      const validated = validateF1Document(validDocument);
      if (!validated.text.includes("Max Verstappen")) {
        throw new Error("Document validation failed");
      }

      // Test invalid document (should throw)
      try {
        validateF1Document({
          text: "", // Invalid - empty text
          embedding: [1, 2, 3], // Invalid - wrong dimension
          source: "",
          category: "invalid_category" as any,
          season: "not_a_year",
        });
        throw new Error("Schema should have rejected invalid document");
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Expected validation error
          console.log(`     Schema correctly rejected invalid data`);
        } else {
          throw error;
        }
      }
    });
  }

  // Test database connection
  async testDatabaseConnection(): Promise<void> {
    await this.runTest("Database Connection", async () => {
      const db = getDatabase();
      console.log(`     Using: ${db.getProviderName()}`);

      const health = await db.healthCheck();
      if (health.status !== "healthy") {
        throw new Error(`Database unhealthy: ${health.details.error}`);
      }

      console.log(`     Documents: ${health.details.documentsCount}`);
    });
  }

  // Test embeddings generation
  async testEmbeddings(): Promise<void> {
    await this.runTest("Embedding Generation", async () => {
      const testText = "Lewis Hamilton won the 2024 Brazilian Grand Prix.";

      const result = await generateEmbedding(testText, {
        inputType: "search_document",
      });

      if (!result.data || !result.data[0] || !result.data[0].embedding) {
        throw new Error("Invalid embedding response format");
      }

      const embedding = result.data[0].embedding;
      if (!Array.isArray(embedding) || embedding.length !== 1024) {
        throw new Error(`Expected 1024-dim embedding, got ${embedding.length}`);
      }

      console.log(`     Generated ${embedding.length}-dimensional embedding`);
    });
  }

  // Test chat response generation
  async testChatGeneration(): Promise<void> {
    await this.runTest("Chat Response Generation", async () => {
      const question = "What is Formula 1?";
      const context = [
        "Formula 1 is the highest class of international auto racing.",
        "F1 cars are the fastest regulated road-course racing cars in the world.",
      ];

      const response = await generateResponse(question, context, {
        maxTokens: 100,
        temperature: 0.3,
      });

      if (!response || response.length < 10) {
        throw new Error("Generated response too short or empty");
      }

      if (!response.toLowerCase().includes("formula")) {
        throw new Error("Response doesn't seem relevant to Formula 1");
      }

      console.log(`     Generated ${response.length} character response`);
    });
  }

  // Test database search (if data exists)
  async testDatabaseSearch(): Promise<void> {
    await this.runTest("Database Search", async () => {
      const db = getDatabase();
      const stats = await db.getStatistics();

      if (stats.totalDocuments === 0) {
        console.log("     Skipping - no data ingested yet");
        return;
      }

      // Generate embedding for search
      const searchText = "Red Bull Racing Max Verstappen";
      const embeddingResult = await generateEmbedding(searchText, {
        inputType: "search_query",
      });

      if (!embeddingResult.data[0]) {
        throw new Error("Failed to generate search embedding");
      }

      // Search database
      const searchResults = await db.searchDocuments({
        query: searchText,
        embedding: embeddingResult.data[0].embedding,
        limit: 5,
        threshold: 0.7,
      });

      console.log(`     Found ${searchResults.length} relevant documents`);

      if (searchResults.length > 0) {
        const firstResult = searchResults[0];
        console.log(`     Top result: ${firstResult.text.substring(0, 80)}...`);
        console.log(`     Similarity: ${firstResult.similarity.toFixed(3)}`);
      }
    });
  }

  // Test data validation during insertion
  async testDataInsertion(): Promise<void> {
    await this.runTest("Data Insertion Validation", async () => {
      const db = getDatabase();

      // Create test document
      const testDoc: F1Document = {
        text: "Test document for embedding",
        embedding: new Array(1024).fill(0.5),
        source: "test_source.csv",
        category: "drivers",
        season: "2024",
        driver: "Test Driver",
        team: "Test Team",
        points: 100,
        constructor: "Test Constructor",
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
      };

      // Insert test document
      const results = await db.insertDocuments([testDoc]);

      if (!results || results.length === 0) {
        throw new Error("Failed to insert test document");
      }

      console.log(`     Successfully inserted test document`);

      // Clean up - search for and remove the test document
      try {
        const embeddingResult = await generateEmbedding(testDoc.text);
        const searchResults = await db.searchDocuments({
          query: "test validation",
          embedding: embeddingResult.data[0].embedding,
          limit: 1,
          filters: { category: "drivers" },
        });

        if (searchResults.length > 0) {
          console.log(`     Test document found in search results`);
        }
      } catch (error) {
        console.log(`     Warning: Could not verify test document: ${error}`);
      }
    });
  }

  // Run all tests
  async runAllTests(): Promise<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  }> {
    console.log("🏎️ F1 RAG AI System Test Suite\n");
    console.log("=" + "=".repeat(50));

    await this.testConfiguration();
    await this.testSchemaValidation();
    await this.testDatabaseConnection();
    await this.testEmbeddings();
    await this.testChatGeneration();
    await this.testDatabaseSearch();
    await this.testDataInsertion();

    // Print summary
    console.log("\n" + "=" + "=".repeat(50));
    console.log("📊 Test Summary");
    console.log("=" + "=".repeat(50));

    const passed = this.results.filter((r) => r.status === "pass").length;
    const failed = this.results.filter((r) => r.status === "fail").length;
    const skipped = this.results.filter((r) => r.status === "skip").length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.results
        .filter((r) => r.status === "fail")
        .forEach((result) => {
          console.log(`   • ${result.name}: ${result.error}`);
        });
    }

    console.log("\n" + "=" + "=".repeat(50));

    if (failed === 0) {
      console.log("🎉 All tests passed! System is working correctly.");
    } else {
      console.log("⚠️ Some tests failed. Please check the errors above.");
    }

    return { total, passed, failed, skipped };
  }
}

// Main execution
async function main() {
  try {
    const tester = new F1SystemTester();
    const summary = await tester.runAllTests();

    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Test suite failed to run:", error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  main();
}

export default F1SystemTester;
export { F1SystemTester, type TestResult };
