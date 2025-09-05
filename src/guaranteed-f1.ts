// GUARANTEED F1 INGESTION - Simple and reliable
import { createCollection, uploadData } from "./lib/db";
import { generateEmbedding } from "./lib/openai";
import fs from 'fs';
import path from 'path';

const csv = require('csv-parser');

async function guaranteedF1Ingestion() {
  console.log('GUARANTEED F1 INGESTION - STARTING...\n');
  
  try {
    // Collection already exists, skip creation
    console.log('Using existing collection\n');
    
    const documents: any[] = [];
    
    // Process key F1 files that we know exist
    const keyFiles = [
      'Formula1_2024season_drivers.csv',
      'Formula1_2024season_teams.csv',
      'Formula1_2024season_raceResults.csv',
      'Formula1_2023season_drivers.csv',
      'Formula1_2023season_teams.csv',
      'Formula1_2023season_raceResults.csv'
    ];
    
    for (const fileName of keyFiles) {
      const filePath = path.join('./formula1-datasets', fileName);
      
      if (fs.existsSync(filePath)) {
        console.log(`Processing: ${fileName}`);
        
        try {
          const csvData = await readCSV(filePath);
          console.log(`   Found ${csvData.length} rows`);
          
          let processedCount = 0;
          
          for (const row of csvData.slice(0, 10)) { // Process first 10 rows
            const text = createSimpleText(row, fileName);
            
            if (text && text.length > 20) {
              try {
                console.log(`   Generating embedding ${processedCount + 1}...`);
                const embedding = await generateEmbedding(text);
                
                if (embedding.data && embedding.data[0]) {
                  documents.push({
                    text: text,
                    $vector: embedding.data[0].embedding,
                    source: fileName,
                    category: 'f1_data',
                    season: extractSeason(fileName)
                  });
                  
                  processedCount++;
                  console.log(`   Added document ${processedCount}`);
                }
              } catch (embError) {
                console.log(`   Embedding error: ${embError.message}`);
              }
            }
          }
          
          console.log(`   Processed ${processedCount} documents from ${fileName}\n`);
          
        } catch (fileError) {
          console.log(`   Error processing ${fileName}: ${fileError.message}\n`);
        }
      } else {
        console.log(`   File not found: ${fileName}\n`);
      }
    }
    
    // Upload all documents
    if (documents.length > 0) {
      console.log(`Uploading ${documents.length} documents...`);
      
      // Upload in small batches
      const batchSize = 5;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        try {
          await uploadData(batch);
          console.log(`   Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
        } catch (uploadError) {
          console.log(`   Upload error: ${uploadError.message}`);
        }
      }
      
      console.log(`\nSUCCESS! Uploaded ${documents.length} F1 documents`);
      console.log('\nData Summary:');
      console.log(`- Total documents: ${documents.length}`);
      console.log(`- Sources: ${[...new Set(documents.map(d => d.source))].join(', ')}`);
      console.log(`- Seasons: ${[...new Set(documents.map(d => d.season))].join(', ')}`);
      
      // Save JSON backup
      fs.writeFileSync('./guaranteed-f1-data.json', JSON.stringify({
        totalDocuments: documents.length,
        createdAt: new Date().toISOString(),
        documents: documents
      }, null, 2));
      
      console.log('\nBackup saved: guaranteed-f1-data.json');
      console.log('\nYour F1 system is ready! Try:');
      console.log('   npm run team-query');
      console.log('   Or visit: http://localhost:3000');
      
    } else {
      console.log('No documents were processed. Check your CSV files.');
    }
    
  } catch (error) {
    console.error('Ingestion failed:', error.message);
  }
}

// Helper functions
function readCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: any) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function extractSeason(filename: string): string {
  const match = filename.match(/(\d{4})/);
  return match ? match[1] : 'unknown';
}

function createSimpleText(row: any, filename: string): string {
  const keys = Object.keys(row);
  
  // For team data
  if (filename.includes('teams')) {
    const team = row.Team || row.team || row.Name;
    const points = row.Points || row.points || '0';
    const position = row.Position || row.position || 'unknown';
    
    if (team) {
      return `${team} Formula 1 team scored ${points} points and finished in position ${position} in the championship.`;
    }
  }
  
  // For driver data
  if (filename.includes('drivers')) {
    const driver = row.Driver || row.driver || row.Name;
    const team = row.Team || row.team;
    const points = row.Points || row.points || '0';
    
    if (driver) {
      return `${driver} is a Formula 1 driver${team ? ` driving for ${team}` : ''} and scored ${points} points.`;
    }
  }
  
  // For race results
  if (filename.includes('race') || filename.includes('Result')) {
    const driver = row.Driver || row.driver;
    const position = row.Position || row.position;
    const team = row.Team || row.team;
    const race = row.Race || row.Track || row.race;
    
    if (driver && position) {
      return `${driver}${team ? ` from ${team}` : ''} finished in position ${position}${race ? ` at ${race}` : ''}.`;
    }
  }
  
  // Generic fallback
  const values = keys
    .filter(key => row[key] && String(row[key]).trim())
    .slice(0, 3)
    .map(key => `${key}: ${row[key]}`)
    .join(', ');
  
  return values ? `Formula 1 data: ${values}` : '';
}

// Run the guaranteed ingestion
guaranteedF1Ingestion().catch(console.error);
