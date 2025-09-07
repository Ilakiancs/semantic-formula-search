import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "dotenv";

config();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface TestResult {
  test: string;
  status: "✅ Pass" | "⚠️ Warning" | "❌ Fail";
  details: string;
  data?: any;
  count?: number;
}

interface DatabaseStats {
  totalDocuments: number;
  categories: Record<string, number>;
  seasons: Record<string, number>;
  drivers: string[];
  teams: string[];
  tracks: string[];
}

// Generate embedding for search queries
async function generateEmbedding(text: string): Promise<number[]> {
  const input = {
    modelId: "cohere.embed-english-v3",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      texts: [text],
      input_type: "search_query",
    }),
  };

  const command = new InvokeModelCommand(input);
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embeddings[0];
}

// Enhanced vector search with filters
async function searchF1Data(
  query: string,
  category?: string,
  season?: string,
  limit: number = 10,
): Promise<any[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc("search_f1_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: limit,
      category_filter: category || null,
      season_filter: season || null,
    });

    if (error) {
      // Fallback to text search
      let queryBuilder = supabase
        .from("f1_documents")
        .select("*")
        .ilike("text", `%${query}%`)
        .limit(limit);

      if (category) queryBuilder = queryBuilder.eq("category", category);
      if (season) queryBuilder = queryBuilder.eq("season", season);

      const { data: fallbackData, error: fallbackError } = await queryBuilder;
      if (fallbackError) throw fallbackError;

      return fallbackData?.map((doc) => ({ ...doc, similarity: 0.5 })) || [];
    }

    return data || [];
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

// Test database connectivity and basic functionality
async function testDatabaseConnectivity(): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from("f1_documents")
      .select("id, category, season")
      .limit(1);

    if (error) {
      return {
        test: "Database Connectivity",
        status: "❌ Fail",
        details: `Connection failed: ${error.message}`,
      };
    }

    return {
      test: "Database Connectivity",
      status: "✅ Pass",
      details: "Successfully connected to Supabase database",
      data: data?.[0] || null,
    };
  } catch (error) {
    return {
      test: "Database Connectivity",
      status: "❌ Fail",
      details: `Unexpected error: ${error}`,
    };
  }
}

// Test data ingestion quality and completeness
async function testDataQuality(): Promise<TestResult> {
  try {
    const { data: stats, error } = await supabase.rpc("get_f1_statistics");

    if (error) {
      return {
        test: "Data Quality",
        status: "❌ Fail",
        details: `Failed to get statistics: ${error.message}`,
      };
    }

    const totalDocs = stats.totalDocuments || 0;
    const categories = stats.categories?.length || 0;
    const seasons = stats.seasons?.length || 0;

    if (totalDocs === 0) {
      return {
        test: "Data Quality",
        status: "❌ Fail",
        details: "No documents found in database",
      };
    }

    const qualityScore =
      categories >= 4 && seasons >= 2
        ? "High"
        : categories >= 2 && seasons >= 1
          ? "Medium"
          : "Low";

    return {
      test: "Data Quality",
      status: totalDocs > 100 ? "✅ Pass" : "⚠️ Warning",
      details: `${totalDocs} documents, ${categories} categories, ${seasons} seasons (${qualityScore} quality)`,
      data: stats,
      count: totalDocs,
    };
  } catch (error) {
    return {
      test: "Data Quality",
      status: "❌ Fail",
      details: `Error assessing data quality: ${error}`,
    };
  }
}

// Test vector search functionality
async function testVectorSearch(): Promise<TestResult> {
  try {
    const searchQueries = [
      "Max Verstappen championship performance",
      "Red Bull Racing team statistics",
      "Formula 1 qualifying results",
      "McLaren driver performance",
    ];

    let totalResults = 0;
    let successfulSearches = 0;

    for (const query of searchQueries) {
      const results = await searchF1Data(query, undefined, undefined, 5);
      if (results.length > 0) {
        successfulSearches++;
        totalResults += results.length;
      }
    }

    const avgResults = totalResults / searchQueries.length;

    if (successfulSearches === searchQueries.length && avgResults >= 3) {
      return {
        test: "Vector Search",
        status: "✅ Pass",
        details: `All ${searchQueries.length} searches successful, avg ${avgResults.toFixed(1)} results per query`,
        count: totalResults,
      };
    } else if (successfulSearches >= searchQueries.length * 0.5) {
      return {
        test: "Vector Search",
        status: "⚠️ Warning",
        details: `${successfulSearches}/${searchQueries.length} searches successful`,
        count: totalResults,
      };
    } else {
      return {
        test: "Vector Search",
        status: "❌ Fail",
        details: `Only ${successfulSearches}/${searchQueries.length} searches successful`,
        count: totalResults,
      };
    }
  } catch (error) {
    return {
      test: "Vector Search",
      status: "❌ Fail",
      details: `Vector search failed: ${error}`,
    };
  }
}

// Test data categorization and filtering
async function testDataCategorization(): Promise<TestResult> {
  try {
    const categories = [
      "drivers",
      "teams",
      "race_results",
      "qualifying",
      "sprint",
      "calendar",
    ];
    const seasons = ["2024", "2023"];

    let categorizedResults: any = {};

    for (const category of categories) {
      const { count, error } = await supabase
        .from("f1_documents")
        .select("*", { count: "exact", head: true })
        .eq("category", category);

      if (!error) {
        categorizedResults[category] = count || 0;
      }
    }

    for (const season of seasons) {
      const { count, error } = await supabase
        .from("f1_documents")
        .select("*", { count: "exact", head: true })
        .eq("season", season);

      if (!error) {
        categorizedResults[`season_${season}`] = count || 0;
      }
    }

    const categoriesWithData = Object.entries(categorizedResults).filter(
      ([key, count]) => !key.startsWith("season_") && (count as number) > 0,
    ).length;

    const seasonsWithData = Object.entries(categorizedResults).filter(
      ([key, count]) => key.startsWith("season_") && (count as number) > 0,
    ).length;

    if (categoriesWithData >= 4 && seasonsWithData >= 2) {
      return {
        test: "Data Categorization",
        status: "✅ Pass",
        details: `${categoriesWithData} categories and ${seasonsWithData} seasons have data`,
        data: categorizedResults,
      };
    } else {
      return {
        test: "Data Categorization",
        status: "⚠️ Warning",
        details: `${categoriesWithData} categories and ${seasonsWithData} seasons have data`,
        data: categorizedResults,
      };
    }
  } catch (error) {
    return {
      test: "Data Categorization",
      status: "❌ Fail",
      details: `Categorization test failed: ${error}`,
    };
  }
}

// Test specific F1 data integrity
async function testF1DataIntegrity(): Promise<TestResult> {
  try {
    // Test for key F1 entities
    const keyDrivers = [
      "Max Verstappen",
      "Lewis Hamilton",
      "Charles Leclerc",
      "Lando Norris",
    ];
    const keyTeams = ["Red Bull Racing", "Mercedes", "Ferrari", "McLaren"];

    let foundDrivers = 0;
    let foundTeams = 0;

    for (const driver of keyDrivers) {
      const results = await searchF1Data(driver, "drivers", undefined, 1);
      if (results.length > 0) foundDrivers++;
    }

    for (const team of keyTeams) {
      const results = await searchF1Data(team, "teams", undefined, 1);
      if (results.length > 0) foundTeams++;
    }

    // Test for race results with proper structure
    const { data: raceResults, error } = await supabase
      .from("f1_documents")
      .select("metadata")
      .eq("category", "race_results")
      .limit(5);

    if (error) throw error;

    let validRaceResults = 0;
    raceResults?.forEach((result) => {
      const metadata = result.metadata;
      if (metadata?.Driver && metadata?.Team && metadata?.Track) {
        validRaceResults++;
      }
    });

    const integrityScore =
      (foundDrivers / keyDrivers.length +
        foundTeams / keyTeams.length +
        validRaceResults / raceResults.length) /
      3;

    if (integrityScore >= 0.8) {
      return {
        test: "F1 Data Integrity",
        status: "✅ Pass",
        details: `High integrity: ${foundDrivers}/${keyDrivers.length} drivers, ${foundTeams}/${keyTeams.length} teams, ${validRaceResults}/${raceResults.length} valid race results`,
        data: { foundDrivers, foundTeams, validRaceResults },
      };
    } else if (integrityScore >= 0.5) {
      return {
        test: "F1 Data Integrity",
        status: "⚠️ Warning",
        details: `Medium integrity: ${foundDrivers}/${keyDrivers.length} drivers, ${foundTeams}/${keyTeams.length} teams`,
        data: { foundDrivers, foundTeams, validRaceResults },
      };
    } else {
      return {
        test: "F1 Data Integrity",
        status: "❌ Fail",
        details: `Low integrity: Missing key F1 entities`,
        data: { foundDrivers, foundTeams, validRaceResults },
      };
    }
  } catch (error) {
    return {
      test: "F1 Data Integrity",
      status: "❌ Fail",
      details: `Integrity test failed: ${error}`,
    };
  }
}

// Test JSON metadata preservation
async function testJSONMetadata(): Promise<TestResult> {
  try {
    const { data: samples, error } = await supabase
      .from("f1_documents")
      .select("metadata, category, source")
      .limit(10);

    if (error) throw error;

    let validMetadata = 0;
    let jsonSources = 0;

    samples?.forEach((doc) => {
      if (doc.source?.endsWith(".json")) jsonSources++;
      if (
        doc.metadata &&
        typeof doc.metadata === "object" &&
        Object.keys(doc.metadata).length > 0
      ) {
        validMetadata++;
      }
    });

    const metadataScore = validMetadata / (samples?.length || 1);

    if (metadataScore >= 0.9 && jsonSources === samples?.length) {
      return {
        test: "JSON Metadata",
        status: "✅ Pass",
        details: `${validMetadata}/${samples?.length} documents have valid metadata, all from JSON sources`,
        count: validMetadata,
      };
    } else if (metadataScore >= 0.7) {
      return {
        test: "JSON Metadata",
        status: "⚠️ Warning",
        details: `${validMetadata}/${samples?.length} documents have valid metadata`,
        count: validMetadata,
      };
    } else {
      return {
        test: "JSON Metadata",
        status: "❌ Fail",
        details: `Poor metadata preservation: ${validMetadata}/${samples?.length}`,
        count: validMetadata,
      };
    }
  } catch (error) {
    return {
      test: "JSON Metadata",
      status: "❌ Fail",
      details: `Metadata test failed: ${error}`,
    };
  }
}

// Advanced F1 analytics test
async function testAdvancedAnalytics(): Promise<TestResult> {
  try {
    // Test championship analysis
    const championshipQuery = "championship points standings drivers 2024";
    const championshipResults = await searchF1Data(
      championshipQuery,
      "drivers",
      "2024",
      5,
    );

    // Test team comparison
    const teamComparisonQuery = "Red Bull Racing McLaren team performance";
    const teamResults = await searchF1Data(
      teamComparisonQuery,
      "teams",
      undefined,
      4,
    );

    // Test race analysis
    const raceAnalysisQuery = "Bahrain Grand Prix race results";
    const raceResults = await searchF1Data(
      raceAnalysisQuery,
      "race_results",
      undefined,
      10,
    );

    // Test qualifying analysis
    const qualifyingQuery = "qualifying results pole position";
    const qualifyingResults = await searchF1Data(
      qualifyingQuery,
      "qualifying",
      undefined,
      5,
    );

    const analyticsTests = [
      { name: "Championship Analysis", results: championshipResults.length },
      { name: "Team Comparison", results: teamResults.length },
      { name: "Race Analysis", results: raceResults.length },
      { name: "Qualifying Analysis", results: qualifyingResults.length },
    ];

    const successfulTests = analyticsTests.filter(
      (test) => test.results > 0,
    ).length;
    const totalResults = analyticsTests.reduce(
      (sum, test) => sum + test.results,
      0,
    );

    if (successfulTests === analyticsTests.length && totalResults >= 15) {
      return {
        test: "Advanced Analytics",
        status: "✅ Pass",
        details: `All ${analyticsTests.length} analytics types working, ${totalResults} total results`,
        data: analyticsTests,
      };
    } else if (successfulTests >= 3) {
      return {
        test: "Advanced Analytics",
        status: "⚠️ Warning",
        details: `${successfulTests}/${analyticsTests.length} analytics types working`,
        data: analyticsTests,
      };
    } else {
      return {
        test: "Advanced Analytics",
        status: "❌ Fail",
        details: `Only ${successfulTests}/${analyticsTests.length} analytics types working`,
        data: analyticsTests,
      };
    }
  } catch (error) {
    return {
      test: "Advanced Analytics",
      status: "❌ Fail",
      details: `Analytics test failed: ${error}`,
    };
  }
}

// Comprehensive database statistics
async function getDatabaseStatistics(): Promise<DatabaseStats | null> {
  try {
    const { data: stats, error } = await supabase.rpc("get_f1_statistics");

    if (error || !stats) return null;

    // Get additional detailed statistics
    const categoryBreakdown: Record<string, number> = {};
    const { data: categoryData } = await supabase
      .from("f1_documents")
      .select("category");

    categoryData?.forEach((doc) => {
      categoryBreakdown[doc.category] =
        (categoryBreakdown[doc.category] || 0) + 1;
    });

    const seasonBreakdown: Record<string, number> = {};
    const { data: seasonData } = await supabase
      .from("f1_documents")
      .select("season");

    seasonData?.forEach((doc) => {
      seasonBreakdown[doc.season] = (seasonBreakdown[doc.season] || 0) + 1;
    });

    return {
      totalDocuments: stats.totalDocuments || 0,
      categories: categoryBreakdown,
      seasons: seasonBreakdown,
      drivers: stats.drivers || [],
      teams: stats.teams || [],
      tracks: [], // Will be populated from race results if needed
    };
  } catch (error) {
    console.error("Error getting database statistics:", error);
    return null;
  }
}

// Display test results
function displayTestResults(results: TestResult[]): void {
  console.log("\n🏎️ F1 JSON DATA TEST RESULTS");
  console.log("=".repeat(60));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.status} ${result.test}`);
    console.log(`   ${result.details}`);
    if (result.count !== undefined) {
      console.log(`   Count: ${result.count.toLocaleString()}`);
    }
  });

  const passCount = results.filter((r) => r.status === "✅ Pass").length;
  const warnCount = results.filter((r) => r.status === "⚠️ Warning").length;
  const failCount = results.filter((r) => r.status === "❌ Fail").length;

  console.log("\n" + "=".repeat(60));
  console.log(
    `📊 TEST SUMMARY: ${passCount} Pass | ${warnCount} Warning | ${failCount} Fail`,
  );

  if (failCount === 0 && warnCount <= 1) {
    console.log("🎉 EXCELLENT: JSON data system is working optimally!");
  } else if (failCount === 0) {
    console.log("✅ GOOD: JSON data system is working well with minor issues");
  } else if (failCount <= 2) {
    console.log(
      "⚠️ ISSUES: JSON data system has some problems that need attention",
    );
  } else {
    console.log(
      "❌ CRITICAL: JSON data system has major issues requiring immediate fixes",
    );
  }
}

// Display database statistics
function displayDatabaseStatistics(stats: DatabaseStats): void {
  console.log("\n📊 DATABASE STATISTICS");
  console.log("=".repeat(60));

  console.log(`📈 Total Documents: ${stats.totalDocuments.toLocaleString()}`);

  console.log("\n📂 Documents by Category:");
  Object.entries(stats.categories)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count.toLocaleString()}`);
    });

  console.log("\n📅 Documents by Season:");
  Object.entries(stats.seasons)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([season, count]) => {
      console.log(`   ${season}: ${count.toLocaleString()}`);
    });

  console.log(`\n🏁 Teams Available: ${stats.teams.length}`);
  console.log(`🏎️ Drivers Available: ${stats.drivers.length}`);

  if (stats.teams.length > 0) {
    console.log(
      `   Top Teams: ${stats.teams.slice(0, 5).join(", ")}${stats.teams.length > 5 ? "..." : ""}`,
    );
  }

  if (stats.drivers.length > 0) {
    console.log(
      `   Top Drivers: ${stats.drivers.slice(0, 5).join(", ")}${stats.drivers.length > 5 ? "..." : ""}`,
    );
  }
}

// Sample queries demonstration
async function demonstrateSampleQueries(): Promise<void> {
  console.log("\n🔍 SAMPLE QUERY DEMONSTRATIONS");
  console.log("=".repeat(60));

  const sampleQueries = [
    {
      title: "Driver Performance Analysis",
      query: "Max Verstappen 2024 championship points podiums",
      category: "drivers",
      season: "2024",
    },
    {
      title: "Team Comparison",
      query: "Red Bull Racing team statistics performance",
      category: "teams",
      season: "2024",
    },
    {
      title: "Race Results Analysis",
      query: "Bahrain Grand Prix race results winner",
      category: "race_results",
      season: undefined,
    },
    {
      title: "Qualifying Performance",
      query: "pole position qualifying results fastest",
      category: "qualifying",
      season: "2024",
    },
  ];

  for (const sample of sampleQueries) {
    console.log(`\n🎯 ${sample.title}`);
    console.log(`   Query: "${sample.query}"`);

    try {
      const results = await searchF1Data(
        sample.query,
        sample.category,
        sample.season,
        3,
      );

      if (results.length > 0) {
        console.log(`   ✅ Found ${results.length} results:`);
        results.forEach((result, index) => {
          const preview = result.text.substring(0, 80) + "...";
          console.log(
            `      ${index + 1}. [${result.category}] ${result.season} - ${preview}`,
          );
        });
      } else {
        console.log(`   ❌ No results found`);
      }
    } catch (error) {
      console.log(`   ❌ Query failed: ${error}`);
    }

    // Add small delay between queries
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Main test function
async function runJSONDataTests(): Promise<void> {
  console.log("🚀 F1 JSON DATA COMPREHENSIVE TESTING");
  console.log("=====================================");
  console.log("Testing enhanced JSON-based F1 data system...\n");

  try {
    const tests: TestResult[] = [];

    // Run all tests
    console.log("🔍 Running comprehensive tests...");

    tests.push(await testDatabaseConnectivity());
    tests.push(await testDataQuality());
    tests.push(await testVectorSearch());
    tests.push(await testDataCategorization());
    tests.push(await testF1DataIntegrity());
    tests.push(await testJSONMetadata());
    tests.push(await testAdvancedAnalytics());

    // Display results
    displayTestResults(tests);

    // Get and display database statistics
    const stats = await getDatabaseStatistics();
    if (stats) {
      displayDatabaseStatistics(stats);
    }

    // Demonstrate sample queries
    await demonstrateSampleQueries();

    // Final system status
    const passCount = tests.filter((r) => r.status === "✅ Pass").length;
    const totalTests = tests.length;

    console.log("\n" + "=".repeat(60));
    console.log("🎯 FINAL SYSTEM STATUS");
    console.log("=".repeat(60));

    if (passCount === totalTests) {
      console.log("🏆 SYSTEM STATUS: FULLY OPERATIONAL");
      console.log("✅ JSON-based F1 data system is working perfectly");
      console.log("✅ All tests passed successfully");
      console.log("✅ Ready for production use");
    } else if (passCount >= totalTests * 0.8) {
      console.log("✅ SYSTEM STATUS: OPERATIONAL WITH MINOR ISSUES");
      console.log("⚠️ Most tests passed with some warnings");
      console.log("💡 Minor optimizations recommended");
    } else {
      console.log("⚠️ SYSTEM STATUS: NEEDS ATTENTION");
      console.log("❌ Several tests failed");
      console.log("🔧 System requires fixes before production use");
    }

    console.log("\n💡 Next Steps:");
    console.log("   • Run specific analytics: npx ts-node src/f1-analytics.ts");
    console.log("   • Test web interface: cd ui && npm run dev");
    console.log("   • System monitoring: npx ts-node src/system-summary.ts");
  } catch (error) {
    console.error("❌ Test suite failed:", error);
  }
}

// Export functions for external use
export {
  runJSONDataTests,
  testDatabaseConnectivity,
  testDataQuality,
  testVectorSearch,
  testDataCategorization,
  testF1DataIntegrity,
  testJSONMetadata,
  testAdvancedAnalytics,
  getDatabaseStatistics,
  searchF1Data,
  TestResult,
  DatabaseStats,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runJSONDataTests().catch(console.error);
}
