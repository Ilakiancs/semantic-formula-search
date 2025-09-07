import { z } from "zod";
import chalk from "chalk";
import { config, isSupabaseConfigured, isAstraConfigured } from "./lib/config";
import { getDatabase } from "./lib/db";
import { testBedrockConnection, getAvailableModels } from "./lib/openai";
import { healthCheck as supabaseHealthCheck } from "./lib/supabase";

// Setup check result schema
const SetupCheckResultSchema = z.object({
  name: z.string(),
  status: z.enum(["pass", "fail", "warning"]),
  message: z.string(),
  details: z.array(z.string()).optional(),
  fix: z.string().optional(),
});

type SetupCheckResult = z.infer<typeof SetupCheckResultSchema>;

interface SetupSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  overall: "pass" | "fail" | "warning";
  ready: boolean;
}

class SetupChecker {
  private results: SetupCheckResult[] = [];

  private addResult(
    result: Omit<SetupCheckResult, "status"> & {
      status: SetupCheckResult["status"];
    },
  ) {
    const validatedResult = SetupCheckResultSchema.parse(result);
    this.results.push(validatedResult);
  }

  // Check environment variables
  async checkEnvironmentVariables(): Promise<void> {
    console.log(chalk.blue("🔍 Checking environment variables..."));

    try {
      // AWS Configuration
      if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
        this.addResult({
          name: "AWS Credentials",
          status: "pass",
          message: "AWS credentials are configured",
          details: [`Region: ${config.AWS_REGION}`],
        });
      } else {
        this.addResult({
          name: "AWS Credentials",
          status: "fail",
          message: "AWS credentials are missing",
          details: [
            `AWS_ACCESS_KEY_ID: ${config.AWS_ACCESS_KEY_ID ? "✓" : "✗"}`,
            `AWS_SECRET_ACCESS_KEY: ${config.AWS_SECRET_ACCESS_KEY ? "✓" : "✗"}`,
          ],
          fix: "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file",
        });
      }

      // Database Configuration
      const supabaseConfigured = isSupabaseConfigured();
      const astraConfigured = isAstraConfigured();

      if (supabaseConfigured || astraConfigured) {
        const dbType = supabaseConfigured ? "Supabase" : "DataStax Astra DB";
        this.addResult({
          name: "Database Configuration",
          status: "pass",
          message: `${dbType} is configured`,
          details: supabaseConfigured
            ? [
                `Supabase URL: ${config.SUPABASE_URL ? "✓" : "✗"}`,
                `Anon Key: ${config.SUPABASE_ANON_KEY ? "✓" : "✗"}`,
              ]
            : [
                `Astra Token: ${config.ASTRA_DB_APPLICATION_TOKEN ? "✓" : "✗"}`,
                `Astra Endpoint: ${config.ASTRA_DB_API_ENDPOINT ? "✓" : "✗"}`,
              ],
        });
      } else {
        this.addResult({
          name: "Database Configuration",
          status: "fail",
          message: "No database is configured",
          details: [
            "Neither Supabase nor DataStax Astra DB is properly configured",
          ],
          fix: "Configure either Supabase (SUPABASE_URL, SUPABASE_ANON_KEY) or Astra DB (ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT)",
        });
      }

      // Bedrock Models
      this.addResult({
        name: "Bedrock Models",
        status: "pass",
        message: "Bedrock models are configured",
        details: [
          `Embedding Model: ${config.BEDROCK_EMBEDDING_MODEL}`,
          `Chat Model: ${config.BEDROCK_CHAT_MODEL}`,
        ],
      });
    } catch (error) {
      this.addResult({
        name: "Environment Variables",
        status: "fail",
        message: "Environment validation failed",
        details: [error instanceof Error ? error.message : String(error)],
        fix: "Check your .env file and ensure all required variables are set",
      });
    }
  }

  // Check AWS Bedrock connection
  async checkBedrockConnection(): Promise<void> {
    console.log(chalk.blue("🧠 Testing AWS Bedrock connection..."));

    try {
      const bedrockTest = await testBedrockConnection();

      if (bedrockTest.status === "healthy") {
        this.addResult({
          name: "AWS Bedrock",
          status: "pass",
          message: "AWS Bedrock is working correctly",
          details: [
            `Embedding Model: ${bedrockTest.details.embeddingModel} ${bedrockTest.details.embeddingTest ? "✓" : "✗"}`,
            `Chat Model: ${bedrockTest.details.chatModel} ${bedrockTest.details.chatTest ? "✓" : "✗"}`,
          ],
        });
      } else {
        this.addResult({
          name: "AWS Bedrock",
          status: "fail",
          message: "AWS Bedrock connection failed",
          details: bedrockTest.details.error ? [bedrockTest.details.error] : [],
          fix: "Check your AWS credentials and ensure you have access to Bedrock in the specified region",
        });
      }
    } catch (error) {
      this.addResult({
        name: "AWS Bedrock",
        status: "fail",
        message: "Failed to test Bedrock connection",
        details: [error instanceof Error ? error.message : String(error)],
        fix: "Verify AWS credentials and Bedrock service availability",
      });
    }
  }

  // Check database connection
  async checkDatabaseConnection(): Promise<void> {
    console.log(chalk.blue("🗄️ Testing database connection..."));

    try {
      const db = getDatabase();
      const healthCheck = await db.healthCheck();

      if (healthCheck.status === "healthy") {
        this.addResult({
          name: "Database Connection",
          status: "pass",
          message: `${db.getProviderName()} is working correctly`,
          details: [
            `Documents: ${healthCheck.details.documentsCount}`,
            `Tables exist: ${healthCheck.details.tablesExist ? "✓" : "✗"}`,
          ],
        });
      } else {
        this.addResult({
          name: "Database Connection",
          status: "fail",
          message: `${db.getProviderName()} connection failed`,
          details: healthCheck.details.error ? [healthCheck.details.error] : [],
          fix: "Check your database credentials and ensure the database is accessible",
        });
      }
    } catch (error) {
      this.addResult({
        name: "Database Connection",
        status: "fail",
        message: "Failed to test database connection",
        details: [error instanceof Error ? error.message : String(error)],
        fix: "Verify database configuration and network connectivity",
      });
    }
  }

  // Check if required CSV files exist
  async checkDataFiles(): Promise<void> {
    console.log(chalk.blue("📁 Checking F1 data files..."));

    const fs = require("fs");
    const path = require("path");

    const requiredFiles = [
      "Formula1_2024season_drivers.csv",
      "Formula1_2024season_teams.csv",
      "Formula1_2024season_raceResults.csv",
      "Formula1_2023season_drivers.csv",
      "Formula1_2023season_teams.csv",
      "Formula1_2023season_raceResults.csv",
    ];

    const existingFiles: string[] = [];
    const missingFiles: string[] = [];

    for (const file of requiredFiles) {
      const filePath = path.join("./formula1-datasets", file);
      if (fs.existsSync(filePath)) {
        existingFiles.push(file);
      } else {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length === 0) {
      this.addResult({
        name: "F1 Data Files",
        status: "pass",
        message: "All required F1 data files are present",
        details: [`Found ${existingFiles.length} files`],
      });
    } else if (existingFiles.length > 0) {
      this.addResult({
        name: "F1 Data Files",
        status: "warning",
        message: "Some F1 data files are missing",
        details: [
          `Found: ${existingFiles.length}`,
          `Missing: ${missingFiles.length}`,
          ...missingFiles.slice(0, 3).map((f) => `- ${f}`),
          ...(missingFiles.length > 3
            ? [`... and ${missingFiles.length - 3} more`]
            : []),
        ],
        fix: "Download missing CSV files to the formula1-datasets directory",
      });
    } else {
      this.addResult({
        name: "F1 Data Files",
        status: "fail",
        message: "No F1 data files found",
        details: [`Expected files in ./formula1-datasets/`],
        fix: "Download F1 CSV files to the formula1-datasets directory",
      });
    }
  }

  // Check if data has been ingested
  async checkDataIngestion(): Promise<void> {
    console.log(chalk.blue("📊 Checking data ingestion status..."));

    try {
      const db = getDatabase();
      const stats = await db.getStatistics();

      if (stats.totalDocuments > 0) {
        this.addResult({
          name: "Data Ingestion",
          status: "pass",
          message: "F1 data has been ingested",
          details: [
            `Total documents: ${stats.totalDocuments}`,
            `Categories: ${stats.categories.length}`,
            `Seasons: ${stats.seasons.join(", ")}`,
          ],
        });
      } else {
        this.addResult({
          name: "Data Ingestion",
          status: "warning",
          message: "No F1 data has been ingested yet",
          details: ["Database is empty"],
          fix: "Run 'npm run ingest' to load F1 data into the database",
        });
      }
    } catch (error) {
      this.addResult({
        name: "Data Ingestion",
        status: "fail",
        message: "Failed to check ingestion status",
        details: [error instanceof Error ? error.message : String(error)],
        fix: "Ensure database is properly configured and accessible",
      });
    }
  }

  // Check Node.js and package dependencies
  async checkDependencies(): Promise<void> {
    console.log(chalk.blue("📦 Checking dependencies..."));

    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

      if (majorVersion >= 18) {
        this.addResult({
          name: "Node.js Version",
          status: "pass",
          message: `Node.js ${nodeVersion} is supported`,
        });
      } else {
        this.addResult({
          name: "Node.js Version",
          status: "fail",
          message: `Node.js ${nodeVersion} is not supported`,
          details: ["Minimum required version: Node.js 18"],
          fix: "Update to Node.js 18 or higher",
        });
      }

      // Check if critical packages are available
      const criticalPackages = [
        "@aws-sdk/client-bedrock-runtime",
        "@datastax/astra-db-ts",
        "@supabase/supabase-js",
        "zod",
        "csv-parser",
      ];

      const packageDetails: string[] = [];
      let allPackagesAvailable = true;

      for (const pkg of criticalPackages) {
        try {
          require.resolve(pkg);
          packageDetails.push(`${pkg}: ✓`);
        } catch {
          packageDetails.push(`${pkg}: ✗`);
          allPackagesAvailable = false;
        }
      }

      if (allPackagesAvailable) {
        this.addResult({
          name: "Dependencies",
          status: "pass",
          message: "All critical packages are installed",
          details: packageDetails,
        });
      } else {
        this.addResult({
          name: "Dependencies",
          status: "fail",
          message: "Some critical packages are missing",
          details: packageDetails,
          fix: "Run 'npm install' to install missing packages",
        });
      }
    } catch (error) {
      this.addResult({
        name: "Dependencies",
        status: "fail",
        message: "Failed to check dependencies",
        details: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  // Print results
  private printResults(): SetupSummary {
    console.log("\n" + "=".repeat(60));
    console.log(chalk.bold.cyan("🏎️  F1 RAG AI SETUP VERIFICATION RESULTS"));
    console.log("=".repeat(60));

    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const result of this.results) {
      let icon: string;
      let color: (text: string) => string;

      switch (result.status) {
        case "pass":
          icon = "✅";
          color = chalk.green;
          passed++;
          break;
        case "fail":
          icon = "❌";
          color = chalk.red;
          failed++;
          break;
        case "warning":
          icon = "⚠️";
          color = chalk.yellow;
          warnings++;
          break;
      }

      console.log(`\n${icon} ${chalk.bold(color(result.name))}`);
      console.log(`   ${color(result.message)}`);

      if (result.details && result.details.length > 0) {
        result.details.forEach((detail) => {
          console.log(`   ${chalk.gray("•")} ${chalk.gray(detail)}`);
        });
      }

      if (result.fix && result.status !== "pass") {
        console.log(`   ${chalk.cyan("💡 Fix:")} ${result.fix}`);
      }
    }

    const totalChecks = this.results.length;
    const overall: SetupSummary["overall"] =
      failed > 0 ? "fail" : warnings > 0 ? "warning" : "pass";

    const ready = failed === 0;

    console.log("\n" + "=".repeat(60));
    console.log(chalk.bold("📊 SUMMARY"));
    console.log("=".repeat(60));
    console.log(`Total checks: ${totalChecks}`);
    console.log(`${chalk.green("✅ Passed:")} ${passed}`);
    console.log(`${chalk.yellow("⚠️  Warnings:")} ${warnings}`);
    console.log(`${chalk.red("❌ Failed:")} ${failed}`);

    console.log("\n" + "=".repeat(60));

    if (ready) {
      console.log(chalk.green(chalk.bold("🎉 SYSTEM READY!")));
      console.log(
        chalk.green(
          "Your F1 RAG AI system is properly configured and ready to use.",
        ),
      );

      console.log(chalk.bold("\n🚀 Quick Start:"));
      console.log("1. Ingest data: " + chalk.cyan("npm run ingest"));
      console.log("2. Test queries: " + chalk.cyan("npm run answer"));
      console.log("3. Start UI: " + chalk.cyan("cd ui && npm run dev"));
    } else {
      console.log(chalk.red(chalk.bold("❌ SETUP INCOMPLETE")));
      console.log(
        chalk.red("Please fix the failed checks above before proceeding."),
      );

      console.log(chalk.bold("\n🔧 Common Fixes:"));
      console.log("• Set AWS credentials in .env file");
      console.log("• Configure database (Supabase or Astra DB)");
      console.log("• Install dependencies: " + chalk.cyan("npm install"));
      console.log("• Download F1 CSV files to formula1-datasets/");
    }

    if (warnings > 0) {
      console.log(chalk.yellow(chalk.bold("\n⚠️  WARNINGS")));
      console.log(
        chalk.yellow("Some optional features may not work properly."),
      );
    }

    console.log("=".repeat(60));

    return {
      totalChecks,
      passed,
      failed,
      warnings,
      overall,
      ready,
    };
  }

  // Run all checks
  async runAllChecks(): Promise<SetupSummary> {
    console.log(chalk.cyan(chalk.bold("🏎️ F1 RAG AI - Setup Verification\n")));

    await this.checkDependencies();
    await this.checkEnvironmentVariables();
    await this.checkBedrockConnection();
    await this.checkDatabaseConnection();
    await this.checkDataFiles();
    await this.checkDataIngestion();

    return this.printResults();
  }
}

// Main function
async function main() {
  try {
    const checker = new SetupChecker();
    const summary = await checker.runAllChecks();

    // Exit with appropriate code
    process.exit(summary.ready ? 0 : 1);
  } catch (error) {
    console.error(chalk.red("\n❌ Setup verification failed:"), error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  main();
}

export default main;
export { SetupChecker, type SetupCheckResult, type SetupSummary };
