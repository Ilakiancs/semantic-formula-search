import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
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

// CSV files to process
const csvFiles = [
  {
    filename: "Formula1_2024season_drivers.csv",
    category: "drivers",
    season: "2024",
  },
  {
    filename: "Formula1_2024season_teams.csv",
    category: "teams",
    season: "2024",
  },
  {
    filename: "Formula1_2024season_raceResults.csv",
    category: "race_results",
    season: "2024",
  },
  {
    filename: "Formula1_2023season_drivers.csv",
    category: "drivers",
    season: "2023",
  },
  {
    filename: "Formula1_2023season_teams.csv",
    category: "teams",
    season: "2023",
  },
  {
    filename: "Formula1_2023season_raceResults.csv",
    category: "race_results",
    season: "2023",
  },
];

// Generate embedding using Bedrock
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

  try {
    const command = new InvokeModelCommand(input);
    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.embeddings[0];
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

// Create descriptive text for different data types
function createDescription(row: any, category: string, season: string): string {
  switch (category) {
    case "drivers":
      return `${row.Driver || "Unknown Driver"} is a Formula 1 driver racing for ${row.Team || "Unknown Team"} in the ${season} season. They are from ${row.Country || "Unknown Country"} and have scored ${row.Points || 0} championship points with ${row.Podiums || 0} podium finishes. They have entered ${row["Grands Prix Entered"] || 0} Grand Prix races and have ${row["World Championships"] || 0} world championships.`;

    case "teams":
      return `${row.Team || "Unknown Team"} (${row["Full Team Name"] || row.Team}) is a Formula 1 team based in ${row.Base || "Unknown Location"} competing in the ${season} season. The team is led by ${row["Team Chief"] || "Unknown Team Chief"} and uses ${row["Power Unit"] || "Unknown Engine"} power units. They have won ${row["World Championships"] || 0} world championships and achieved ${row["Pole Positions"] || 0} pole positions.`;

    case "race_results":
      const positionText =
        row.Position === "DNF"
          ? "did not finish"
          : row.Position === "DSQ"
            ? "was disqualified"
            : `finished in position ${row.Position}`;
      return `In the ${season} Formula 1 season at ${row.Track || "Unknown Track"}, ${row.Driver || "Unknown Driver"} driving for ${row.Team || "Unknown Team"} ${positionText}${row.Points ? ` and scored ${row.Points} points` : ""}. They completed ${row.Laps || 0} laps${row["Set Fastest Lap"] === "Yes" ? " and set the fastest lap" : ""}.`;

    default:
      return `Formula 1 ${category} data from ${season} season: ${JSON.stringify(row).substring(0, 200)}...`;
  }
}

// Read and process CSV file
async function processCSVFile(
  filename: string,
  category: string,
  season: string,
): Promise<void> {
  const filePath = path.join("formula1-datasets", filename);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }

  console.log(`\nProcessing: ${filename}`);
  console.log(`   Category: ${category}`);
  console.log(`   Season: ${season}`);

  const rows: any[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        // Clean up the row data
        const cleanRow: any = {};
        for (const [key, value] of Object.entries(row)) {
          if (value && typeof value === "string" && value.trim() !== "") {
            cleanRow[key.trim()] = value.trim();
          }
        }
        if (Object.keys(cleanRow).length > 0) {
          rows.push(cleanRow);
        }
      })
      .on("end", async () => {
        console.log(`   Read ${rows.length} rows from CSV`);

        let processed = 0;
        let successful = 0;

        for (const row of rows.slice(0, 20)) {
          // Limit to 20 rows for testing
          try {
            processed++;

            // Create descriptive text
            const description = createDescription(row, category, season);

            // Generate embedding
            const embedding = await generateEmbedding(description);

            // Insert into Supabase
            const { error } = await supabase.from("f1_documents").insert({
              text: description,
              embedding: embedding,
              source: filename,
              category: category,
              season: season,
              track: row.Track || null,
              driver: row.Driver || null,
              team: row.Team || null,
              position: row.Position ? parseInt(row.Position) || null : null,
              points: row.Points ? parseFloat(row.Points) || null : null,
              metadata: row,
            });

            if (error) {
              console.log(
                `   Error inserting row ${processed}: ${error.message}`,
              );
            } else {
              successful++;
              if (successful % 5 === 0) {
                console.log(
                  `   Processed ${successful}/${rows.length} rows...`,
                );
              }
            }

            // Add delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            console.log(`   Error processing row ${processed}: ${error}`);
          }
        }

        console.log(
          `   Completed: ${successful}/${processed} rows successfully inserted`,
        );
        resolve();
      })
      .on("error", reject);
  });
}

// Main ingestion function
async function main() {
  console.log("SIMPLE F1 DATA INGESTION");
  console.log("================================\n");

  // Clear existing data (optional)
  console.log("Clearing existing documents...");
  const { error: deleteError } = await supabase
    .from("f1_documents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all except non-existent ID

  if (deleteError) {
    console.log("⚠️  Error clearing documents:", deleteError.message);
  } else {
    console.log("✅ Existing documents cleared");
  }

  // Process each CSV file
  for (const file of csvFiles) {
    try {
      await processCSVFile(file.filename, file.category, file.season);
    } catch (error) {
      console.error(`❌ Error processing ${file.filename}:`, error);
    }
  }

  // Check final count
  const { count, error: countError } = await supabase
    .from("f1_documents")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ Error getting document count:", countError);
  } else {
    console.log(`\nINGESTION COMPLETE!`);
    console.log(`Total documents in database: ${count}`);
  }
}

// Run the ingestion
main().catch(console.error);
