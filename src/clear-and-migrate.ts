import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

interface ClearResult {
  component: string;
  status: "✅ Success" | "⚠️ Warning" | "❌ Error";
  details: string;
  count?: number;
}

// Clear all existing F1 documents
async function clearF1Documents(): Promise<ClearResult> {
  try {
    console.log("🗄️ Clearing existing F1 documents...");

    // First, get count of existing documents
    const { count: currentCount, error: countError } = await supabase
      .from("f1_documents")
      .select("*", { count: "exact", head: true });

    if (countError) {
      return {
        component: "Document Count",
        status: "❌ Error",
        details: `Failed to count documents: ${countError.message}`,
      };
    }

    console.log(`📊 Found ${currentCount || 0} existing documents`);

    if (currentCount === 0) {
      return {
        component: "Clear Documents",
        status: "✅ Success",
        details: "Database already empty",
        count: 0,
      };
    }

    // Delete all documents
    const { error: deleteError } = await supabase
      .from("f1_documents")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all (using non-existent ID)

    if (deleteError) {
      return {
        component: "Clear Documents",
        status: "❌ Error",
        details: `Failed to delete documents: ${deleteError.message}`,
      };
    }

    // Verify deletion
    const { count: finalCount, error: verifyError } = await supabase
      .from("f1_documents")
      .select("*", { count: "exact", head: true });

    if (verifyError) {
      return {
        component: "Clear Documents",
        status: "⚠️ Warning",
        details: `Documents deleted but verification failed: ${verifyError.message}`,
        count: currentCount,
      };
    }

    return {
      component: "Clear Documents",
      status: "✅ Success",
      details: `Successfully cleared ${currentCount} documents`,
      count: currentCount,
    };

  } catch (error) {
    return {
      component: "Clear Documents",
      status: "❌ Error",
      details: `Unexpected error: ${error}`,
    };
  }
}

// Test database connection and table structure
async function testDatabaseConnection(): Promise<ClearResult> {
  try {
    console.log("🔍 Testing database connection...");

    // Test basic connection
    const { data, error } = await supabase
      .from("f1_documents")
      .select("id")
      .limit(1);

    if (error) {
      return {
        component: "Database Connection",
        status: "❌ Error",
        details: `Connection failed: ${error.message}`,
      };
    }

    // Test if required functions exist
    const { data: statsData, error: statsError } = await supabase
      .rpc("get_f1_statistics");

    if (statsError) {
      return {
        component: "Database Connection",
        status: "⚠️ Warning",
        details: "Connection OK but statistics function missing",
      };
    }

    return {
      component: "Database Connection",
      status: "✅ Success",
      details: "Database connection and functions verified",
    };

  } catch (error) {
    return {
      component: "Database Connection",
      status: "❌ Error",
      details: `Unexpected error: ${error}`,
    };
  }
}

// Verify JSON files are available
async function verifyJSONFiles(): Promise<ClearResult> {
  try {
    console.log("📁 Verifying JSON files...");

    const fs = require('fs');
    const path = require('path');

    const datasetPath = path.join(process.cwd(), 'formula1-datasets');

    if (!fs.existsSync(datasetPath)) {
      return {
        component: "JSON Files",
        status: "❌ Error",
        details: "formula1-datasets directory not found",
      };
    }

    const files = fs.readdirSync(datasetPath).filter((file: string) => file.endsWith('.json'));

    if (files.length === 0) {
      return {
        component: "JSON Files",
        status: "❌ Error",
        details: "No JSON files found in formula1-datasets directory",
      };
    }

    // Check some key files
    const keyFiles = [
      'Formula1_2024season_drivers.json',
      'Formula1_2024season_teams.json',
      'Formula1_2024season_raceResults.json',
      'Formula1_2023season_drivers.json',
      'Formula1_2023season_teams.json',
      'Formula1_2023season_raceResults.json',
    ];

    const foundKeyFiles = keyFiles.filter(file => files.includes(file));

    return {
      component: "JSON Files",
      status: "✅ Success",
      details: `Found ${files.length} JSON files (${foundKeyFiles.length}/${keyFiles.length} key files)`,
      count: files.length,
    };

  } catch (error) {
    return {
      component: "JSON Files",
      status: "❌ Error",
      details: `Error checking files: ${error}`,
    };
  }
}

// Display results
function displayResults(results: ClearResult[]): void {
  console.log("\n🏎️ CLEAR AND MIGRATE RESULTS");
  console.log("=" .repeat(50));

  results.forEach((result) => {
    console.log(`\n${result.status} ${result.component}`);
    console.log(`   ${result.details}`);
    if (result.count !== undefined) {
      console.log(`   Count: ${result.count}`);
    }
  });

  const successCount = results.filter(r => r.status === "✅ Success").length;
  const totalCount = results.length;

  console.log("\n" + "=".repeat(50));
  console.log(`📊 OVERALL: ${successCount}/${totalCount} operations successful`);

  if (successCount === totalCount) {
    console.log("🎉 READY FOR JSON MIGRATION");
    console.log("\n💡 Next steps:");
    console.log("   1. Run: npx ts-node src/json-ingest.ts");
    console.log("   2. Test: npx ts-node src/test-json-data.ts");
    console.log("   3. Verify: npm run check-setup");
  } else {
    console.log("⚠️ ISSUES DETECTED - Check errors above");
  }
}

// Main migration function
async function clearAndMigrate(): Promise<void> {
  console.log("🚀 F1 RAG AI - CLEAR & MIGRATE TO JSON");
  console.log("=====================================");
  console.log("Preparing to migrate from CSV to JSON format...\n");

  try {
    const results: ClearResult[] = [];

    // Step 1: Test database connection
    results.push(await testDatabaseConnection());

    // Step 2: Clear existing data
    results.push(await clearF1Documents());

    // Step 3: Verify JSON files
    results.push(await verifyJSONFiles());

    // Display results
    displayResults(results);

  } catch (error) {
    console.error("❌ Migration preparation failed:", error);
  }
}

// Export functions for use in other modules
export {
  clearF1Documents,
  testDatabaseConnection,
  verifyJSONFiles,
  clearAndMigrate,
  ClearResult,
};

// Run if executed directly
if (require.main === module) {
  clearAndMigrate().catch(console.error);
}
