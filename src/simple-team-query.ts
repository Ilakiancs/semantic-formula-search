// Simple Red Bull vs McLaren Query
import { queryDatabase } from "./lib/db";
import * as fs from 'fs';
import * as path from 'path';

async function simpleRedBullMcLarenQuery() {
  console.log('SIMPLE RED BULL vs McLAREN QUERY\n');
  
  try {
    // Create a simple embedding manually to test database
    console.log('Testing with manual vector search...');
    
    // Use a dummy embedding vector - just to test if we have any data
    const dummyEmbedding = new Array(1024).fill(0.1);
    
    const results = await queryDatabase(dummyEmbedding);
    console.log(`Found ${results.length} total documents in database\n`);
    
    if (results.length === 0) {
      console.log('No documents found in database');
      return;
    }
    
    // Show first few documents
    console.log('Sample documents:');
    results.slice(0, 5).forEach((doc, i) => {
      console.log(`\n${i + 1}. ${doc.text?.substring(0, 150)}...`);
      console.log(`   Source: ${doc.source} | Season: ${doc.season}`);
    });
    
    // Filter for Red Bull
    const redBullDocs = results.filter(doc => 
      doc.text?.toLowerCase().includes('red bull') ||
      doc.text?.toLowerCase().includes('redbull') ||
      doc.text?.toLowerCase().includes('rb')
    );
    
    console.log(`\nRED BULL documents found: ${redBullDocs.length}`);
    if (redBullDocs.length > 0) {
      redBullDocs.slice(0, 3).forEach((doc, i) => {
        console.log(`\n   ${i + 1}. ${doc.text?.substring(0, 100)}...`);
      });
    }
    
    // Filter for McLaren
    const mclarenDocs = results.filter(doc => 
      doc.text?.toLowerCase().includes('mclaren')
    );
    
    console.log(`\nMcLAREN documents found: ${mclarenDocs.length}`);
    if (mclarenDocs.length > 0) {
      mclarenDocs.slice(0, 3).forEach((doc, i) => {
        console.log(`\n   ${i + 1}. ${doc.text?.substring(0, 100)}...`);
      });
    }
    
    // Basic comparison
    if (redBullDocs.length > 0 && mclarenDocs.length > 0) {
      console.log('\nBASIC PERFORMANCE COMPARISON:');
      console.log('═'.repeat(50));
      console.log(`Red Bull Racing: ${redBullDocs.length} relevant records`);
      console.log(`McLaren: ${mclarenDocs.length} relevant records`);
      
      // Look for specific performance indicators
      const redBullWins = redBullDocs.filter(doc => 
        doc.text?.toLowerCase().includes('1st') || 
        doc.text?.toLowerCase().includes('win') ||
        doc.text?.toLowerCase().includes('victory')
      );
      
      const mclarenWins = mclarenDocs.filter(doc => 
        doc.text?.toLowerCase().includes('1st') || 
        doc.text?.toLowerCase().includes('win') ||
        doc.text?.toLowerCase().includes('victory')
      );
      
      console.log(`\nPotential wins/victories:`);
      console.log(`Red Bull: ${redBullWins.length} documents mention wins/victories`);
      console.log(`McLaren: ${mclarenWins.length} documents mention wins/victories`);
    }
    
  } catch (error) {
    console.error('Query failed:', error);
  }
}

simpleRedBullMcLarenQuery();
