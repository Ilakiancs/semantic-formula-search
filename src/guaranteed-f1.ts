import { z } from "zod";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { getDatabase } from "./lib/db";
import { generateBatchEmbeddings } from "./lib/openai";
import {
  F1Document,
  F1DocumentSchema,
  validateF1Document,
  safeValidateF1Document,
  normalizeDriverData,
  normalizeTeamData,
  normalizeRaceResultData,
  ProcessingOptions,
  ProcessingOptionsSchema,
} from "./lib/schemas";
import { config } from "./lib/config";

// CSV file configuration
const CSV_FILES = [
  {
    filename: "Formula1_2024season_drivers.csv",
    category: "drivers" as const,
    season: "2024",
    priority: 1,
  },
  {
    filename: "Formula1_2024season_teams.csv",
    category: "teams" as const,
    season: "2024",
    priority: 1,
  },
  {
    filename: "Formula1_2024season_raceResults.csv",
    category: "race_results" as const,
    season: "2024",
    priority: 1,
  },
  {
    filename: "Formula1_2023season_drivers.csv",
    category: "drivers" as const,
    season: "2023",
    priority: 2,
  },
  {
    filename: "Formula1_2023season_teams.csv",
    category: "teams" as const,
    season: "2023",
    priority: 2,
  },
  {
    filename: "Formula1_2023season_raceResults.csv",
    category: "race_results" as const,
    season: "2023",
    priority: 2,
  },
  {
    filename: "Formula1_2022season_drivers.csv",
    category: "drivers" as const,
    season: "2022",
    priority: 3,
  },
  {
    filename: "Formula1_2022season_teams.csv",
    category: "teams" as const,
    season: "2022",
    priority: 3,
  },
  {
    filename: "Formula1_2022season_raceResults.csv",
    category: "race_results" as const,
    season: "2022",
    priority: 3,
  },
  {
    filename: "Formula1_2025Season_RaceResults.csv",
    category: "race_results" as const,
    season: "2025",
    priority: 1,
  },
] as const;

// Ingestion options schema
const IngestionOptionsSchema = z.object({
  maxRowsPerFile: z.number().int().positive().default(20),
  batchSize: z.number().int().positive().max(10).default(5),
  validateOnly: z.boolean().default(false),
  includeAllFiles: z.boolean().default(false),
  priorityThreshold: z.number().int().min(1).max(3).default(2),
  embeddingDelay: z.number().int().nonnegative().default(1000),
});

type IngestionOptions = z.infer<typeof IngestionOptionsSchema>;

// Default processing options
const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  maxRows: 1000,
  skipHeader: true,
  delimiter: ",",
  encoding: "utf8",
  validateSchema: true,
};

interface ProcessingStats {
  filesProcessed: number;
  totalRows: number;
  validDocuments: number;
  invalidDocuments: number;
  embeddingsGenerated: number;
  documentsInserted: number;
  errors: string[];
  warnings: string[];
  processingTime: number;
}

// Read CSV file with error handling
async function readCSVFile(
  filePath: string,
  options: ProcessingOptions = DEFAULT_PROCESSING_OPTIONS,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    let rowCount = 0;

    console.log(`   📖 Reading CSV file: ${path.basename(filePath)}`);

    const stream = fs
      .createReadStream(filePath, {
        encoding: options.encoding as BufferEncoding,
      })
      .pipe(csv({ separator: options.delimiter }))
      .on("data", (data: any) => {
        rowCount++;

        if (rowCount <= options.maxRows) {
          // Clean up data - remove empty strings and whitespace
          const cleanData: any = {};
          Object.keys(data).forEach((key) => {
            const value = data[key]?.toString().trim();
            if (value && value !== "") {
              cleanData[key] = value;
            }
          });

          if (Object.keys(cleanData).length > 0) {
            results.push(cleanData);
          }
        }
      })
      .on("end", () => {
        console.log(`   ✅ Read ${results.length} valid rows from CSV`);
        resolve(results);
      })
      .on("error", (error) => {
        console.error(`   ❌ CSV reading error: ${error.message}`);
        reject(error);
      });
  });
}

// Create descriptive text from CSV data
function createDescriptiveText(
  row: any,
  category: string,
  season: string,
  filename: string,
): string {
  try {
    switch (category) {
      case "drivers":
        const driver = normalizeDriverData({ ...row, season });
        return `${driver.driver} is a Formula 1 driver${
          driver.team ? ` racing for ${driver.team}` : ""
        }${driver.constructor ? ` with ${driver.constructor}` : ""} in the ${season} season. They scored ${
          driver.points
        } championship points${driver.position ? ` and finished ${driver.position}${getOrdinalSuffix(driver.position)} in the drivers' championship` : ""}${
          driver.wins > 0 ? ` with ${driver.wins} race wins` : ""
        }${driver.podiums > 0 ? ` and ${driver.podiums} podium finishes` : ""}.`;

      case "teams":
        const team = normalizeTeamData({ ...row, season });
        return `${team.team} is a Formula 1 team${
          team.constructor ? ` competing as ${team.constructor}` : ""
        } in the ${season} season. The team scored ${team.points} championship points${
          team.position
            ? ` and finished ${team.position}${getOrdinalSuffix(team.position)} in the constructors' championship`
            : ""
        }${team.wins > 0 ? ` with ${team.wins} race wins` : ""}${
          team.engine ? ` using ${team.engine} engines` : ""
        }.`;

      case "race_results":
        const result = normalizeRaceResultData({ ...row, season });
        const positionText =
          typeof result.position === "number"
            ? `${result.position}${getOrdinalSuffix(result.position)} place`
            : result.position;

        return `In the ${season} Formula 1 season${
          result.race ? ` at the ${result.race}` : ""
        }${result.track ? ` (${result.track})` : ""}, ${result.driver}${
          result.team ? ` driving for ${result.team}` : ""
        } finished in ${positionText}${result.points > 0 ? ` and scored ${result.points} points` : ""}${
          result.fastest_lap ? " with the fastest lap" : ""
        }${result.time ? ` with a time of ${result.time}` : ""}.`;

      case "qualifying":
        return `In ${season} Formula 1 qualifying${row.Race ? ` for the ${row.Race}` : ""}${
          row.Track ? ` at ${row.Track}` : ""
        }, ${row.Driver || row.driver}${row.Team ? ` from ${row.Team}` : ""} qualified in ${
          row.Position || row.position
        }${getOrdinalSuffix(parseInt(row.Position || row.position))} position${
          row.Q3_Time || row.q3_time
            ? ` with a Q3 time of ${row.Q3_Time || row.q3_time}`
            : ""
        }.`;

      case "sprint":
        return `In the ${season} Formula 1 sprint race${row.Race ? ` at the ${row.Race}` : ""}${
          row.Track ? ` (${row.Track})` : ""
        }, ${row.Driver || row.driver}${row.Team ? ` from ${row.Team}` : ""} finished in ${
          row.Position || row.position
        }${getOrdinalSuffix(parseInt(row.Position || row.position))} place${
          row.Points && parseFloat(row.Points) > 0
            ? ` and scored ${row.Points} points`
            : ""
        }.`;

      default:
        // Generic fallback for other categories
        const keys = Object.keys(row);
        const importantFields = keys
          .filter((key) => {
            const value = row[key];
            return (
              value &&
              value.toString().trim() !== "" &&
              !key.toLowerCase().includes("id") &&
              !key.toLowerCase().includes("timestamp")
            );
          })
          .slice(0, 4); // Limit to first 4 meaningful fields

        const description = importantFields
          .map((key) => `${key}: ${row[key]}`)
          .join(", ");

        return `Formula 1 ${category} data from ${season}: ${description}.`;
    }
  } catch (error) {
    console.warn(`   ⚠️ Error creating descriptive text: ${error}`);

    // Fallback to simple text creation
    const values = Object.keys(row)
      .filter((key) => row[key] && row[key].toString().trim())
      .slice(0, 3)
      .map((key) => `${key}: ${row[key]}`)
      .join(", ");

    return values
      ? `Formula 1 ${category} data from ${season}: ${values}.`
      : `Formula 1 ${category} information from the ${season} season.`;
  }
}

// Get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
}

// Process a single CSV file
async function processCSVFile(
  fileConfig: (typeof CSV_FILES)[number],
  options: IngestionOptions,
): Promise<{
  documents: F1Document[];
  stats: {
    rowsProcessed: number;
    validDocuments: number;
    invalidDocuments: number;
    errors: string[];
  };
}> {
  const filePath = path.join("./formula1-datasets", fileConfig.filename);
  const stats = {
    rowsProcessed: 0,
    validDocuments: 0,
    invalidDocuments: 0,
    errors: [] as string[],
  };

  console.log(`\n📂 Processing: ${fileConfig.filename}`);
  console.log(`   Category: ${fileConfig.category}`);
  console.log(`   Season: ${fileConfig.season}`);

  if (!fs.existsSync(filePath)) {
    const error = `File not found: ${fileConfig.filename}`;
    console.log(`   ❌ ${error}`);
    stats.errors.push(error);
    return { documents: [], stats };
  }

  try {
    // Read CSV data
    const csvData = await readCSVFile(filePath, {
      ...DEFAULT_PROCESSING_OPTIONS,
      maxRows: options.maxRowsPerFile,
    });

    if (csvData.length === 0) {
      const error = `No valid data found in ${fileConfig.filename}`;
      console.log(`   ⚠️ ${error}`);
      stats.errors.push(error);
      return { documents: [], stats };
    }

    console.log(`   🔄 Processing ${csvData.length} rows...`);

    const documents: F1Document[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      stats.rowsProcessed++;

      try {
        // Create descriptive text
        const text = createDescriptiveText(
          row,
          fileConfig.category,
          fileConfig.season,
          fileConfig.filename,
        );

        if (!text || text.length < 10) {
          stats.invalidDocuments++;
          continue;
        }

        // Create F1Document (without embedding for now)
        const document: Partial<F1Document> = {
          text,
          embedding: [], // Will be filled later
          source: fileConfig.filename,
          category: fileConfig.category,
          season: fileConfig.season,
          track: row.Track || row.track || row.Circuit || null,
          driver: row.Driver || row.driver || null,
          team: row.Team || row.team || null,
          constructor: row.Constructor || row["Constructor"] || null,
          position: row.Position ? parseInt(row.Position) : null,
          points: row.Points ? parseFloat(row.Points) : null,
          metadata: {
            originalRow: { ...row, constructor: undefined }, // Remove JS constructor
            filename: fileConfig.filename,
            rowIndex: i,
          },
        };

        // Validate document structure (without embedding)
        const validationResult = safeValidateF1Document({
          ...document,
          embedding: new Array(1024).fill(0), // Temporary embedding for validation
        });

        if (validationResult.success) {
          documents.push({
            ...validationResult.data,
            embedding: [], // Reset embedding to empty array
          });
          stats.validDocuments++;
        } else {
          stats.invalidDocuments++;
          const error = `Row ${i + 1}: ${validationResult.error.errors.map((e) => e.message).join(", ")}`;
          stats.errors.push(error);
          console.warn(`   ⚠️ ${error}`);
        }
      } catch (error) {
        stats.invalidDocuments++;
        const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(errorMsg);
        console.warn(`   ⚠️ ${errorMsg}`);
      }
    }

    console.log(
      `   ✅ Processed: ${stats.validDocuments} valid, ${stats.invalidDocuments} invalid documents`,
    );

    return { documents, stats };
  } catch (error) {
    const errorMsg = `Failed to process ${fileConfig.filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`   ❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
    return { documents: [], stats };
  }
}

// Main ingestion function
async function guaranteedF1Ingestion(
  userOptions: Partial<IngestionOptions> = {},
): Promise<ProcessingStats> {
  const startTime = Date.now();
  const options = IngestionOptionsSchema.parse(userOptions);

  console.log("🚀 GUARANTEED F1 INGESTION - STARTING...\n");
  console.log("📋 Configuration:");
  console.log(`   Max rows per file: ${options.maxRowsPerFile}`);
  console.log(`   Batch size: ${options.batchSize}`);
  console.log(`   Validate only: ${options.validateOnly}`);
  console.log(`   Include all files: ${options.includeAllFiles}`);
  console.log(`   Priority threshold: ${options.priorityThreshold}`);
  console.log(`   Embedding delay: ${options.embeddingDelay}ms\n`);

  const stats: ProcessingStats = {
    filesProcessed: 0,
    totalRows: 0,
    validDocuments: 0,
    invalidDocuments: 0,
    embeddingsGenerated: 0,
    documentsInserted: 0,
    errors: [],
    warnings: [],
    processingTime: 0,
  };

  try {
    // Initialize database
    console.log("🗄️ Initializing database...");
    const db = getDatabase();
    await db.initialize();
    console.log(`✅ Database initialized: ${db.getProviderName()}\n`);

    // Filter files based on priority and options
    const filesToProcess = options.includeAllFiles
      ? CSV_FILES
      : CSV_FILES.filter((file) => file.priority <= options.priorityThreshold);

    console.log(
      `📁 Processing ${filesToProcess.length} files (priority ≤ ${options.priorityThreshold}):\n`,
    );

    const allDocuments: F1Document[] = [];

    // Process each file
    for (const fileConfig of filesToProcess) {
      const { documents, stats: fileStats } = await processCSVFile(
        fileConfig,
        options,
      );

      stats.filesProcessed++;
      stats.totalRows += fileStats.rowsProcessed;
      stats.validDocuments += fileStats.validDocuments;
      stats.invalidDocuments += fileStats.invalidDocuments;
      stats.errors.push(...fileStats.errors);

      allDocuments.push(...documents);

      // Small delay to avoid overwhelming the system
      if (fileConfig !== filesToProcess[filesToProcess.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (allDocuments.length === 0) {
      console.log("❌ No valid documents to process");
      stats.processingTime = Date.now() - startTime;
      return stats;
    }

    console.log(
      `\n🧠 Generating embeddings for ${allDocuments.length} documents...`,
    );

    if (options.validateOnly) {
      console.log(
        "ℹ️ Validation-only mode - skipping embeddings and database insertion",
      );
      stats.processingTime = Date.now() - startTime;
      return stats;
    }

    // Generate embeddings in batches
    const textsToEmbed = allDocuments.map((doc) => doc.text);
    const embeddingResults = await generateBatchEmbeddings(
      textsToEmbed,
      options.batchSize,
      { inputType: "search_document" },
    );

    stats.embeddingsGenerated = embeddingResults.length;

    if (embeddingResults.length !== allDocuments.length) {
      const warning = `Embedding count mismatch: ${embeddingResults.length} embeddings for ${allDocuments.length} documents`;
      console.warn(`⚠️ ${warning}`);
      stats.warnings.push(warning);
    }

    // Combine documents with embeddings
    const documentsWithEmbeddings: F1Document[] = [];
    for (
      let i = 0;
      i < Math.min(allDocuments.length, embeddingResults.length);
      i++
    ) {
      const document = allDocuments[i];
      const embedding = embeddingResults[i];

      if (embedding?.data?.[0]?.embedding) {
        documentsWithEmbeddings.push({
          ...document,
          embedding: embedding.data[0].embedding,
        });
      } else {
        const warning = `Missing embedding for document ${i}`;
        console.warn(`⚠️ ${warning}`);
        stats.warnings.push(warning);
      }
    }

    console.log(
      `\n💾 Inserting ${documentsWithEmbeddings.length} documents into database...`,
    );

    // Insert documents in batches
    const insertBatchSize = Math.min(options.batchSize, 10);
    for (let i = 0; i < documentsWithEmbeddings.length; i += insertBatchSize) {
      const batch = documentsWithEmbeddings.slice(i, i + insertBatchSize);

      try {
        await db.insertDocuments(batch);
        stats.documentsInserted += batch.length;
        console.log(
          `   ✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1}/${Math.ceil(documentsWithEmbeddings.length / insertBatchSize)} (${batch.length} documents)`,
        );
      } catch (error) {
        const errorMsg = `Batch ${Math.floor(i / insertBatchSize) + 1} insertion failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }

      // Delay between batches
      if (i + insertBatchSize < documentsWithEmbeddings.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.embeddingDelay),
        );
      }
    }

    // Generate summary
    console.log("\n🎉 INGESTION COMPLETE!");
    console.log("\n📊 Summary:");
    console.log(`   Files processed: ${stats.filesProcessed}`);
    console.log(`   Total rows: ${stats.totalRows}`);
    console.log(`   Valid documents: ${stats.validDocuments}`);
    console.log(`   Invalid documents: ${stats.invalidDocuments}`);
    console.log(`   Embeddings generated: ${stats.embeddingsGenerated}`);
    console.log(`   Documents inserted: ${stats.documentsInserted}`);
    console.log(
      `   Processing time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    );

    if (stats.warnings.length > 0) {
      console.log(`\n⚠️ Warnings (${stats.warnings.length}):`);
      stats.warnings
        .slice(0, 5)
        .forEach((warning) => console.log(`   - ${warning}`));
      if (stats.warnings.length > 5) {
        console.log(`   ... and ${stats.warnings.length - 5} more`);
      }
    }

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 5).forEach((error) => console.log(`   - ${error}`));
      if (stats.errors.length > 5) {
        console.log(`   ... and ${stats.errors.length - 5} more`);
      }
    }

    // Save backup
    const backupData = {
      stats,
      timestamp: new Date().toISOString(),
      configuration: options,
      databaseProvider: db.getProviderName(),
    };

    fs.writeFileSync(
      "./f1-ingestion-log.json",
      JSON.stringify(backupData, null, 2),
    );

    console.log("\n💾 Ingestion log saved: f1-ingestion-log.json");
    console.log("\n🏎️ Your F1 system is ready! Try:");
    console.log("   npm run team-analysis");
    console.log("   npm run answer");
    console.log("   cd ui && npm run dev");

    stats.processingTime = Date.now() - startTime;
    return stats;
  } catch (error) {
    const errorMsg = `Ingestion failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`\n❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
    stats.processingTime = Date.now() - startTime;
    return stats;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: Partial<IngestionOptions> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--max-rows":
        options.maxRowsPerFile = parseInt(args[++i]);
        break;
      case "--batch-size":
        options.batchSize = parseInt(args[++i]);
        break;
      case "--validate-only":
        options.validateOnly = true;
        break;
      case "--all-files":
        options.includeAllFiles = true;
        break;
      case "--priority":
        options.priorityThreshold = parseInt(args[++i]);
        break;
      case "--delay":
        options.embeddingDelay = parseInt(args[++i]);
        break;
      case "--help":
        console.log("F1 Data Ingestion Tool");
        console.log("\nOptions:");
        console.log(
          "  --max-rows <number>     Max rows per file (default: 20)",
        );
        console.log(
          "  --batch-size <number>   Embedding batch size (default: 5)",
        );
        console.log(
          "  --validate-only         Only validate, don't insert (default: false)",
        );
        console.log(
          "  --all-files             Process all files regardless of priority (default: false)",
        );
        console.log(
          "  --priority <number>     Priority threshold 1-3 (default: 2)",
        );
        console.log(
          "  --delay <number>        Delay between batches in ms (default: 1000)",
        );
        console.log("  --help                  Show this help");
        process.exit(0);
    }
  }

  // Run ingestion
  guaranteedF1Ingestion(options)
    .then((stats) => {
      console.log(
        `\n✅ Ingestion completed with ${stats.documentsInserted} documents inserted`,
      );
      process.exit(stats.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("\n❌ Ingestion failed:", error);
      process.exit(1);
    });
}

export default guaranteedF1Ingestion;
export { guaranteedF1Ingestion, type IngestionOptions, type ProcessingStats };
