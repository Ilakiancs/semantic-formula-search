import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";

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

// Configuration for JSON file processing
interface JSONFileConfig {
  filename: string;
  category: string;
  season: string;
  priority: number;
  description: string;
  enabled: boolean;
}

// Define comprehensive JSON file configurations
const JSON_FILES: JSONFileConfig[] = [
  // 2024 Season - Highest Priority
  {
    filename: "Formula1_2024season_drivers.json",
    category: "drivers",
    season: "2024",
    priority: 1,
    description: "2024 Driver Statistics and Championships",
    enabled: true,
  },
  {
    filename: "Formula1_2024season_teams.json",
    category: "teams",
    season: "2024",
    priority: 1,
    description: "2024 Team Information and Performance",
    enabled: true,
  },
  {
    filename: "Formula1_2024season_raceResults.json",
    category: "race_results",
    season: "2024",
    priority: 1,
    description: "2024 Race Results and Standings",
    enabled: true,
  },
  {
    filename: "Formula1_2024season_qualifyingResults.json",
    category: "qualifying",
    season: "2024",
    priority: 1,
    description: "2024 Qualifying Results",
    enabled: true,
  },
  {
    filename: "Formula1_2024season_sprintResults.json",
    category: "sprint",
    season: "2024",
    priority: 1,
    description: "2024 Sprint Race Results",
    enabled: true,
  },
  {
    filename: "Formula1_2024season_calendar.json",
    category: "calendar",
    season: "2024",
    priority: 1,
    description: "2024 Race Calendar and Schedule",
    enabled: true,
  },

  // 2023 Season - High Priority
  {
    filename: "Formula1_2023season_drivers.json",
    category: "drivers",
    season: "2023",
    priority: 2,
    description: "2023 Driver Statistics and Championships",
    enabled: true,
  },
  {
    filename: "Formula1_2023season_teams.json",
    category: "teams",
    season: "2023",
    priority: 2,
    description: "2023 Team Information and Performance",
    enabled: true,
  },
  {
    filename: "Formula1_2023season_raceResults.json",
    category: "race_results",
    season: "2023",
    priority: 2,
    description: "2023 Race Results and Standings",
    enabled: true,
  },
  {
    filename: "Formula1_2023season_qualifyingResults.json",
    category: "qualifying",
    season: "2023",
    priority: 2,
    description: "2023 Qualifying Results",
    enabled: true,
  },

  // 2022 Season - Medium Priority
  {
    filename: "Formula1_2022season_drivers.json",
    category: "drivers",
    season: "2022",
    priority: 3,
    description: "2022 Driver Statistics and Championships",
    enabled: true,
  },
  {
    filename: "Formula1_2022season_teams.json",
    category: "teams",
    season: "2022",
    priority: 3,
    description: "2022 Team Information and Performance",
    enabled: true,
  },
  {
    filename: "Formula1_2022season_raceResults.json",
    category: "race_results",
    season: "2022",
    priority: 3,
    description: "2022 Race Results and Standings",
    enabled: true,
  },

  // 2025 Season - Future Data
  {
    filename: "Formula1_2025Season_RaceResults.json",
    category: "race_results",
    season: "2025",
    priority: 1,
    description: "2025 Race Results (Future/Projected)",
    enabled: true,
  },

  // Historical Data - Lower Priority
  {
    filename: "formula1_2021season_drivers.json",
    category: "drivers",
    season: "2021",
    priority: 4,
    description: "2021 Driver Statistics",
    enabled: true,
  },
  {
    filename: "formula1_2021season_raceResults.json",
    category: "race_results",
    season: "2021",
    priority: 4,
    description: "2021 Race Results",
    enabled: true,
  },
  {
    filename: "formula1_2020season_drivers.json",
    category: "drivers",
    season: "2020",
    priority: 4,
    description: "2020 Driver Statistics",
    enabled: true,
  },
  {
    filename: "formula1_2020season_raceResults.json",
    category: "race_results",
    season: "2020",
    priority: 4,
    description: "2020 Race Results",
    enabled: true,
  },
];

interface IngestionOptions {
  maxRecordsPerFile: number;
  priorityThreshold: number;
  batchSize: number;
  embeddingDelay: number;
  validateOnly: boolean;
  includeHistorical: boolean;
}

interface ProcessingStats {
  totalFiles: number;
  processedFiles: number;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedFiles: number;
  processingTime: number;
}

// Generate embedding using AWS Bedrock
async function generateEmbedding(text: string): Promise<number[]> {
  const input = {
    modelId: "cohere.embed-english-v3",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      texts: [text],
      input_type: "search_document",
    }),
  };

  const command = new InvokeModelCommand(input);
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embeddings[0];
}

// Create descriptive text based on data type and content
function createDescriptiveText(
  record: any,
  category: string,
  season: string,
  filename: string,
): string {
  try {
    switch (category) {
      case "drivers":
        return createDriverDescription(record, season);
      case "teams":
        return createTeamDescription(record, season);
      case "race_results":
        return createRaceResultDescription(record, season);
      case "qualifying":
        return createQualifyingDescription(record, season);
      case "sprint":
        return createSprintDescription(record, season);
      case "calendar":
        return createCalendarDescription(record, season);
      default:
        return createGenericDescription(record, category, season);
    }
  } catch (error) {
    console.warn(`   Error creating description for ${category}:`, error);
    return createFallbackDescription(record, category, season, filename);
  }
}

function createDriverDescription(driver: any, season: string): string {
  const name = driver.Driver || driver.driver || "Unknown Driver";
  const team = driver.Team || driver.team || "Unknown Team";
  const country = driver.Country || driver.Nationality || "Unknown Country";
  const points = parseFloat(driver.Points || driver.points || 0);
  const podiums = parseInt(driver.Podiums || driver.podiums || 0);
  const championships = parseInt(
    driver["World Championships"] || driver.championships || 0,
  );
  const grandsPrix = parseInt(
    driver["Grands Prix Entered"] || driver.grandsPrix || 0,
  );

  return `${name} is a Formula 1 driver from ${country} racing for ${team} in the ${season} season. He has scored ${points} championship points with ${podiums} podium finishes throughout his career. ${name} has won ${championships} world championships and has participated in ${grandsPrix} Grand Prix races. In ${season}, he represents ${team} and continues to compete at the highest level of motorsport.`;
}

function createTeamDescription(team: any, season: string): string {
  const teamName = team.Team || team.team || "Unknown Team";
  const fullName = team["Full Team Name"] || team.fullName || teamName;
  const base = team.Base || team.base || "Unknown Location";
  const teamChief = team["Team Chief"] || team.teamChief || "Unknown";
  const powerUnit = team["Power Unit"] || team.powerUnit || "Unknown";
  const championships = parseInt(
    team["World Championships"] || team.championships || 0,
  );
  const firstEntry = team["First Team Entry"] || team.firstEntry || "Unknown";

  return `${teamName} (${fullName}) is a Formula 1 constructor based in ${base} competing in the ${season} season. The team is led by ${teamChief} and uses ${powerUnit} power units. ${teamName} has won ${championships} world championships since their first entry in ${firstEntry}. The team continues to develop competitive machinery and compete for wins in the ${season} Formula 1 World Championship.`;
}

function createRaceResultDescription(result: any, season: string): string {
  const track = result.Track || result.track || "Unknown Track";
  const driver = result.Driver || result.driver || "Unknown Driver";
  const team = result.Team || result.team || "Unknown Team";
  const position = result.Position || result.position || "Unknown";
  const points = parseFloat(result.Points || result.points || 0);
  const laps = parseInt(result.Laps || result.laps || 0);
  const time = result["Time/Retired"] || result.Time || result.time || "N/A";
  const fastestLap =
    result["Set Fastest Lap"] === "Yes" ||
    result["Fastest Lap"] === "Yes" ||
    result.fastestLap;

  const positionText =
    position === "DNF"
      ? "did not finish"
      : position === "DSQ"
        ? "was disqualified"
        : `finished in position ${position}`;

  return `In the ${season} Formula 1 season at the ${track} Grand Prix, ${driver} driving for ${team} ${positionText}${points > 0 ? ` and scored ${points} championship points` : ""}. The driver completed ${laps} laps${time !== "N/A" ? ` with a race time of ${time}` : ""}${fastestLap ? " and set the fastest lap of the race" : ""}. This result contributes to both the driver's and constructor's championship standings for the ${season} season.`;
}

function createQualifyingDescription(qualifying: any, season: string): string {
  const track = qualifying.Track || qualifying.track || "Unknown Track";
  const driver = qualifying.Driver || qualifying.driver || "Unknown Driver";
  const team = qualifying.Team || qualifying.team || "Unknown Team";
  const position = qualifying.Position || qualifying.position || "Unknown";
  const q1Time = qualifying["Q1"] || qualifying.q1Time || null;
  const q2Time = qualifying["Q2"] || qualifying.q2Time || null;
  const q3Time = qualifying["Q3"] || qualifying.q3Time || null;

  let timeInfo = "";
  if (q3Time) {
    timeInfo = ` with a best qualifying time of ${q3Time} in Q3`;
  } else if (q2Time) {
    timeInfo = ` with a best time of ${q2Time} in Q2`;
  } else if (q1Time) {
    timeInfo = ` with a time of ${q1Time} in Q1`;
  }

  return `In qualifying for the ${season} ${track} Grand Prix, ${driver} from ${team} qualified in ${position}${getOrdinalSuffix(parseInt(position))} position${timeInfo}. This qualifying performance determines his starting position for the race and is crucial for race strategy and potential points-scoring opportunities.`;
}

function createSprintDescription(sprint: any, season: string): string {
  const track = sprint.Track || sprint.track || "Unknown Track";
  const driver = sprint.Driver || sprint.driver || "Unknown Driver";
  const team = sprint.Team || sprint.team || "Unknown Team";
  const position = sprint.Position || sprint.position || "Unknown";
  const points = parseFloat(sprint.Points || sprint.points || 0);

  return `In the ${season} ${track} Sprint Race, ${driver} driving for ${team} finished in ${position}${getOrdinalSuffix(parseInt(position))} position${points > 0 ? ` and earned ${points} sprint points` : ""}. Sprint races provide additional points-scoring opportunities and can influence grid positions for the main Grand Prix race.`;
}

function createCalendarDescription(event: any, season: string): string {
  const round = event.Round || event.round || "Unknown";
  const race = event.Race || event.race || "Unknown Race";
  const track = event.Track || event.track || "Unknown Track";
  const country = event.Country || event.country || "Unknown Country";
  const date = event.Date || event.date || "Unknown Date";

  return `Round ${round} of the ${season} Formula 1 World Championship is the ${race} held at ${track} in ${country} on ${date}. This race is part of the official ${season} Formula 1 calendar and contributes to both the Drivers' and Constructors' Championships.`;
}

function createGenericDescription(
  record: any,
  category: string,
  season: string,
): string {
  const keys = Object.keys(record).slice(0, 3);
  const values = keys.map((key) => `${key}: ${record[key]}`).join(", ");
  return `Formula 1 ${category} data from the ${season} season containing information about ${values}. This data contributes to the comprehensive Formula 1 database for analysis and insights.`;
}

function createFallbackDescription(
  record: any,
  category: string,
  season: string,
  filename: string,
): string {
  return `Formula 1 ${category} information from the ${season} season (source: ${filename}). This record contains structured data about Formula 1 ${category} for comprehensive analysis and research purposes.`;
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

// Read and process JSON file
async function processJSONFile(
  config: JSONFileConfig,
  options: IngestionOptions,
): Promise<{ processed: number; successful: number; failed: number }> {
  const filePath = path.join("formula1-datasets", config.filename);

  if (!fs.existsSync(filePath)) {
    console.log(`   File not found: ${config.filename}`);
    return { processed: 0, successful: 0, failed: 0 };
  }

  console.log(`\nProcessing: ${config.filename}`);
  console.log(`   Category: ${config.category}`);
  console.log(`   Season: ${config.season}`);
  console.log(`   Priority: ${config.priority}`);
  console.log(`   Description: ${config.description}`);

  try {
    // Read JSON file
    const jsonContent = fs.readFileSync(filePath, "utf8");
    const records = JSON.parse(jsonContent);

    if (!Array.isArray(records)) {
      console.log(`   Invalid JSON format: expected array`);
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`   Read ${records.length} records from JSON`);

    if (options.validateOnly) {
      console.log(`   Validation only - skipping ingestion`);
      return {
        processed: records.length,
        successful: records.length,
        failed: 0,
      };
    }

    // Limit records if specified
    const recordsToProcess = records.slice(0, options.maxRecordsPerFile);
    console.log(`   Processing ${recordsToProcess.length} records...`);

    let successful = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < recordsToProcess.length; i += options.batchSize) {
      const batch = recordsToProcess.slice(i, i + options.batchSize);

      for (const record of batch) {
        try {
          // Create descriptive text
          const description = createDescriptiveText(
            record,
            config.category,
            config.season,
            config.filename,
          );

          // Generate embedding
          const embedding = await generateEmbedding(description);

          // Prepare document for insertion
          const document = {
            text: description,
            embedding: embedding,
            source: config.filename,
            category: config.category,
            season: config.season,
            track: record.Track || record.track || null,
            driver: record.Driver || record.driver || null,
            team: record.Team || record.team || null,
            position: record.Position
              ? parseInt(record.Position) || null
              : null,
            points: record.Points ? parseFloat(record.Points) || null : null,
            metadata: record,
          };

          // Insert into Supabase
          const { error } = await supabase
            .from("f1_documents")
            .insert(document);

          if (error) {
            console.log(`   Insert error: ${error.message}`);
            failed++;
          } else {
            successful++;
            if (successful % 10 === 0) {
              console.log(
                `   Processed ${successful}/${recordsToProcess.length} records...`,
              );
            }
          }

          // Add delay to avoid rate limiting
          if (options.embeddingDelay > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, options.embeddingDelay),
            );
          }
        } catch (error) {
          console.log(`   Record processing error: ${error}`);
          failed++;
        }
      }
    }

    console.log(`   Completed: ${successful} successful, ${failed} failed`);
    return { processed: recordsToProcess.length, successful, failed };
  } catch (error) {
    console.log(`   File processing error: ${error}`);
    return { processed: 0, successful: 0, failed: 0 };
  }
}

// Main ingestion function
async function ingestJSONData(
  options: Partial<IngestionOptions> = {},
): Promise<void> {
  const defaultOptions: IngestionOptions = {
    maxRecordsPerFile: 50,
    priorityThreshold: 3,
    batchSize: 5,
    embeddingDelay: 1000,
    validateOnly: false,
    includeHistorical: false,
  };

  const finalOptions = { ...defaultOptions, ...options };

  console.log("F1 JSON DATA INGESTION SYSTEM");
  console.log("================================");
  console.log(`Configuration:`);
  console.log(`   Max records per file: ${finalOptions.maxRecordsPerFile}`);
  console.log(`   Priority threshold: ${finalOptions.priorityThreshold}`);
  console.log(`   Batch size: ${finalOptions.batchSize}`);
  console.log(`   Embedding delay: ${finalOptions.embeddingDelay}ms`);
  console.log(`   Validate only: ${finalOptions.validateOnly}`);
  console.log(`   Include historical: ${finalOptions.includeHistorical}`);

  const startTime = Date.now();
  const stats: ProcessingStats = {
    totalFiles: 0,
    processedFiles: 0,
    totalRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    skippedFiles: 0,
    processingTime: 0,
  };

  try {
    // Filter files based on options
    let filesToProcess = JSON_FILES.filter((config) => {
      if (!config.enabled) return false;
      if (config.priority > finalOptions.priorityThreshold) return false;
      if (!finalOptions.includeHistorical && parseInt(config.season) < 2022)
        return false;
      return true;
    });

    // Sort by priority (lower number = higher priority)
    filesToProcess.sort((a, b) => a.priority - b.priority);

    stats.totalFiles = filesToProcess.length;
    console.log(`\nProcessing ${stats.totalFiles} JSON files...\n`);

    // Process each file
    for (const fileConfig of filesToProcess) {
      const result = await processJSONFile(fileConfig, finalOptions);

      if (result.processed > 0) {
        stats.processedFiles++;
        stats.totalRecords += result.processed;
        stats.successfulRecords += result.successful;
        stats.failedRecords += result.failed;
      } else {
        stats.skippedFiles++;
      }
    }

    stats.processingTime = Date.now() - startTime;

    // Final statistics
    console.log("\nJSON INGESTION COMPLETE!");
    console.log("================================");
    console.log(`Processing Statistics:`);
    console.log(
      `   Files processed: ${stats.processedFiles}/${stats.totalFiles}`,
    );
    console.log(`   Files skipped: ${stats.skippedFiles}`);
    console.log(`   Total records: ${stats.totalRecords.toLocaleString()}`);
    console.log(
      `   Successful insertions: ${stats.successfulRecords.toLocaleString()}`,
    );
    console.log(
      `   Failed insertions: ${stats.failedRecords.toLocaleString()}`,
    );
    console.log(
      `   Success rate: ${((stats.successfulRecords / stats.totalRecords) * 100).toFixed(1)}%`,
    );
    console.log(
      `   Processing time: ${(stats.processingTime / 1000).toFixed(1)} seconds`,
    );

    if (!finalOptions.validateOnly) {
      // Verify final database state
      const { count, error } = await supabase
        .from("f1_documents")
        .select("*", { count: "exact", head: true });

      if (!error) {
        console.log(
          `   Total documents in database: ${count?.toLocaleString()}`,
        );
      }
    }
  } catch (error) {
    console.error("Ingestion failed:", error);
  }
}

// Export functions and types
export {
  ingestJSONData,
  processJSONFile,
  createDescriptiveText,
  IngestionOptions,
  JSONFileConfig,
  JSON_FILES,
};

// Command line argument parsing
function parseArgs(): Partial<IngestionOptions> {
  const args = process.argv.slice(2);
  const options: Partial<IngestionOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--max-records":
        options.maxRecordsPerFile = parseInt(args[++i]) || 50;
        break;
      case "--priority":
        options.priorityThreshold = parseInt(args[++i]) || 3;
        break;
      case "--batch-size":
        options.batchSize = parseInt(args[++i]) || 5;
        break;
      case "--delay":
        options.embeddingDelay = parseInt(args[++i]) || 1000;
        break;
      case "--validate-only":
        options.validateOnly = true;
        break;
      case "--include-historical":
        options.includeHistorical = true;
        break;
    }
  }

  return options;
}

// Run if executed directly
if (require.main === module) {
  const options = parseArgs();
  ingestJSONData(options).catch(console.error);
}
