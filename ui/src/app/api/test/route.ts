import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Configuration
const supabaseUrl = "https://ukygqtisuqpyxfadqdkk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVreWdxdGlzdXFweXhmYWRxZGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwOTM3MzQsImV4cCI6MjA3MjY2OTczNH0.TmK1nNJdBhPA10M5zc3DeKdO_njntCp7A5YAX0zpkho";

const supabase = createClient(supabaseUrl, supabaseKey);

// Demo F1 data for testing without embeddings
const demoF1Data = [
  {
    id: "demo-1",
    text: "Max Verstappen is a Dutch Formula 1 driver racing for Red Bull Racing in the 2024 season and scored 3023.5 championship points.",
    source: "Formula1_2024season_drivers.csv",
    category: "drivers",
    season: "2024",
    similarity: 0.85,
  },
  {
    id: "demo-2",
    text: "Lewis Hamilton is a British Formula 1 driver racing for Mercedes in the 2024 season and scored 2431.0 championship points.",
    source: "Formula1_2024season_drivers.csv",
    category: "drivers",
    season: "2024",
    similarity: 0.82,
  },
  {
    id: "demo-3",
    text: "Red Bull Racing is a Formula 1 team that scored 5454.5 points in the 2024 season and finished in position 1.",
    source: "Formula1_2024season_teams.csv",
    category: "teams",
    season: "2024",
    similarity: 0.78,
  },
  {
    id: "demo-4",
    text: "In the 2024 Formula 1 season at Bahrain, Max Verstappen from Red Bull Racing Honda RBPT finished in position 1.",
    source: "Formula1_2024season_raceResults.csv",
    category: "race_results",
    season: "2024",
    similarity: 0.75,
  },
  {
    id: "demo-5",
    text: "McLaren is a Formula 1 team that scored 438.0 points in the 2024 season and finished in position 4.",
    source: "Formula1_2024season_teams.csv",
    category: "teams",
    season: "2024",
    similarity: 0.68,
  },
];

function searchF1Data(query: string): typeof demoF1Data {
  const lowerQuery = query.toLowerCase();

  // Simple keyword matching for demo
  const results = demoF1Data.filter((item) => {
    const text = item.text.toLowerCase();

    // Check for key F1 terms
    if (lowerQuery.includes("verstappen") && text.includes("verstappen"))
      return true;
    if (lowerQuery.includes("hamilton") && text.includes("hamilton"))
      return true;
    if (lowerQuery.includes("red bull") && text.includes("red bull"))
      return true;
    if (lowerQuery.includes("mclaren") && text.includes("mclaren")) return true;
    if (lowerQuery.includes("2024") && text.includes("2024")) return true;
    if (
      lowerQuery.includes("championship") &&
      (text.includes("points") || text.includes("position"))
    )
      return true;
    if (lowerQuery.includes("driver") && item.category === "drivers")
      return true;
    if (lowerQuery.includes("team") && item.category === "teams") return true;
    if (lowerQuery.includes("race") && item.category === "race_results")
      return true;
    if (lowerQuery.includes("bahrain") && text.includes("bahrain")) return true;

    return false;
  });

  // Sort by similarity score and return top 3
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

function generateF1Response(
  question: string,
  searchResults: typeof demoF1Data,
): string {
  if (searchResults.length === 0) {
    return "I don't have specific information about that in my Formula 1 database. Try asking about F1 drivers like Max Verstappen or Lewis Hamilton, teams like Red Bull Racing or McLaren, or the 2024 season results.";
  }

  let response = "Based on my Formula 1 database: ";
  const lowerQuestion = question.toLowerCase();

  // Generate contextual responses based on question type and results
  if (lowerQuestion.includes("verstappen")) {
    const verstappenData = searchResults.find((r) =>
      r.text.toLowerCase().includes("verstappen"),
    );
    if (verstappenData) {
      response +=
        "Max Verstappen is one of the dominant drivers in Formula 1, racing for Red Bull Racing. ";
      if (verstappenData.text.includes("3023.5")) {
        response +=
          "In the 2024 season, he scored 3023.5 championship points, showcasing his exceptional performance. ";
      }
      if (searchResults.some((r) => r.text.includes("position 1"))) {
        response +=
          "He has achieved race wins, including at circuits like Bahrain. ";
      }
    }
  } else if (lowerQuestion.includes("hamilton")) {
    const hamiltonData = searchResults.find((r) =>
      r.text.toLowerCase().includes("hamilton"),
    );
    if (hamiltonData) {
      response +=
        "Lewis Hamilton is a legendary Formula 1 driver racing for Mercedes. ";
      if (hamiltonData.text.includes("2431.0")) {
        response +=
          "In the 2024 season, he scored 2431.0 championship points, continuing his impressive career. ";
      }
      response +=
        "Hamilton is known for his multiple world championships and racing excellence. ";
    }
  } else if (lowerQuestion.includes("red bull")) {
    const redBullData = searchResults.find((r) =>
      r.text.toLowerCase().includes("red bull"),
    );
    if (redBullData) {
      response +=
        "Red Bull Racing is one of the top-performing teams in Formula 1. ";
      if (redBullData.text.includes("5454.5")) {
        response +=
          "In the 2024 season, they scored 5454.5 team points and finished in 1st position in the constructors' championship. ";
      }
      response +=
        "The team has been dominant with drivers like Max Verstappen delivering exceptional results. ";
    }
  } else if (lowerQuestion.includes("mclaren")) {
    const mclarenData = searchResults.find((r) =>
      r.text.toLowerCase().includes("mclaren"),
    );
    if (mclarenData) {
      response += "McLaren is a historic and competitive Formula 1 team. ";
      if (mclarenData.text.includes("438.0")) {
        response +=
          "In the 2024 season, they scored 438.0 team points and finished in 4th position in the constructors' championship. ";
      }
      response += "McLaren continues to be a strong competitor in the sport. ";
    }
  } else if (
    lowerQuestion.includes("2024") ||
    lowerQuestion.includes("championship") ||
    lowerQuestion.includes("winner")
  ) {
    response += "The 2024 Formula 1 season has been highly competitive. ";
    const standings = searchResults.filter((r) => r.text.includes("points"));
    if (standings.length > 0) {
      response +=
        "Based on the points standings, Red Bull Racing leads the constructors' championship with 5454.5 points, while Max Verstappen tops the drivers' championship with 3023.5 points. ";
      response +=
        "Other strong performers include Lewis Hamilton with 2431.0 points and McLaren team in 4th position. ";
    }
  } else {
    // Generic response using first result
    const topResult = searchResults[0];
    response += "Here's what I found: " + topResult.text + " ";
    if (searchResults.length > 1) {
      response +=
        "I also found additional relevant information about " +
        searchResults
          .slice(1)
          .map((r) => {
            if (r.category === "drivers") return "driver performance";
            if (r.category === "teams") return "team standings";
            if (r.category === "race_results") return "race results";
            return "F1 data";
          })
          .join(" and ") +
        ".";
    }
  }

  return response;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("F1 Demo API - Processing request...");

    const body = await request.json();
    const message = body.message || body.question;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    console.log(`Question: "${message}"`);

    // Search demo data (no AWS embeddings needed)
    console.log("Searching F1 demo data...");
    const searchResults = searchF1Data(message);
    console.log(`Found ${searchResults.length} relevant results`);

    // Generate response
    const answer = generateF1Response(message, searchResults);

    // Prepare sources
    const sources = searchResults.map((result) => ({
      text:
        result.text.substring(0, 150) + (result.text.length > 150 ? "..." : ""),
      source: result.source,
      category: result.category,
      season: result.season,
      similarity: result.similarity,
    }));

    const response = {
      answer: answer,
      sources: sources,
      metadata: {
        documentsFound: searchResults.length,
        processingTime: Date.now() - startTime,
        model: "F1 Demo System",
        mode: "demo",
        database: "demo-data",
      },
    };

    console.log(`Demo response generated (${answer.length} chars)`);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Demo API error:", error);
    return NextResponse.json(
      {
        error: "Demo API failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Try to get real database stats if available
    let dbStats = null;
    try {
      const { data: stats } = await supabase.rpc("get_f1_statistics");
      dbStats = stats;
    } catch {
      console.log("Database not available, using demo mode");
    }

    return NextResponse.json({
      status: "F1 Demo API Online",
      mode: "demo",
      message: "Demo F1 system with pre-loaded data - no AWS required",
      demo_data: {
        documents: demoF1Data.length,
        categories: ["drivers", "teams", "race_results"],
        seasons: ["2024"],
      },
      real_database: dbStats
        ? {
            connected: true,
            documents: dbStats.totalDocuments,
            categories: dbStats.categories,
            seasons: dbStats.seasons,
          }
        : {
            connected: false,
            status: "Demo mode only",
          },
      example_queries: [
        "Who is Max Verstappen?",
        "Tell me about Red Bull Racing",
        "Who won the 2024 championship?",
        "Compare Lewis Hamilton and Max Verstappen",
        "What are McLaren's 2024 results?",
      ],
    });
  } catch (error) {
    return NextResponse.json({
      status: "Demo API running",
      error: error instanceof Error ? error.message : String(error),
      mode: "demo",
    });
  }
}
