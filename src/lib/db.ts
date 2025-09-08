import { z } from "zod";
import {
  config,
  getDatabaseConfig,
  isSupabaseConfigured,
  isAstraConfigured,
} from "./config";
import {
  F1Document,
  F1DocumentSchema,
  DatabaseQuery,
  DatabaseQuerySchema,
  validateF1Document,
  safeValidateF1Document,
} from "./schemas";

// Supabase imports
import {
  getSupabaseClient,
  insertF1Documents as supabaseInsert,
  searchF1Documents as supabaseSearch,
  getF1DocumentsByFilters as supabaseGetByFilters,
  getF1Statistics as supabaseGetStats,
  clearAllDocuments as supabaseClear,
  healthCheck as supabaseHealthCheck,
  initializeDatabase as supabaseInitialize,
  isSupabaseAvailable,
  type SearchResult as SupabaseSearchResult,
} from "./supabase";

// DataStax Astra DB imports
import { DataAPIClient } from "@datastax/astra-db-ts";

// Database interface types
interface DatabaseProvider {
  name: string;
  insert: (documents: F1Document[]) => Promise<any[]>;
  search: (query: DatabaseQuery) => Promise<SearchResult[]>;
  getByFilters: (filters: DocumentFilters) => Promise<any[]>;
  getStatistics: () => Promise<DatabaseStatistics>;
  clear: () => Promise<void>;
  healthCheck: () => Promise<HealthCheckResult>;
  initialize: () => Promise<void>;
}

interface SearchResult {
  id: string;
  text: string;
  source: string;
  category: string;
  season: string;
  track?: string | null;
  driver?: string | null;
  team?: string | null;
  constructor?: string | null;
  metadata?: Record<string, any> | null;
  similarity: number;
}

interface DocumentFilters {
  category?: string;
  season?: string;
  team?: string;
  driver?: string;
  limit?: number;
}

interface DatabaseStatistics {
  totalDocuments: number;
  categories: string[];
  seasons: string[];
  sources: string[];
  documentsByCategory: Record<string, number>;
  documentsBySeason: Record<string, number>;
}

interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  details: {
    configured: boolean;
    connectionWorking: boolean;
    tablesExist: boolean;
    documentsCount: number;
    error?: string;
  };
}

// Astra DB implementation
class AstraDBProvider implements DatabaseProvider {
  name = "DataStax Astra DB";
  private client: DataAPIClient | null = null;
  private db: any = null;
  private collection: any = null;

  private async getClient() {
    if (!this.client) {
      if (!isAstraConfigured()) {
        throw new Error("DataStax Astra DB not configured");
      }

      const dbConfig = getDatabaseConfig();
      if (dbConfig.type !== "astra") {
        throw new Error("Invalid database configuration for Astra DB");
      }

      this.client = new DataAPIClient(dbConfig.token);
      this.db = this.client.db(dbConfig.endpoint);
      this.collection = this.db.collection("f1gpt");

      console.log("DataStax Astra DB client initialized");
    }

    return { client: this.client, db: this.db, collection: this.collection };
  }

  async initialize(): Promise<void> {
    const { db } = await this.getClient();

    try {
      console.log("Initializing DataStax Astra DB...");

      const res = await db.createCollection("f1gpt", {
        vector: {
          dimension: 1024,
          metric: "dot_product",
        },
      });

      console.log("DataStax Astra DB initialized");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("ℹ️ Collection already exists");
      } else {
        console.error("Failed to initialize Astra DB:", error);
        throw error;
      }
    }
  }

  async insert(documents: F1Document[]): Promise<any[]> {
    const { collection } = await this.getClient();

    // Validate documents
    const validatedDocuments: F1Document[] = [];
    const errors: string[] = [];

    for (let i = 0; i < documents.length; i++) {
      const result = safeValidateF1Document(documents[i]);
      if (result.success) {
        validatedDocuments.push(result.data);
      } else {
        errors.push(
          `Document ${i}: ${result.error.errors.map((e) => e.message).join(", ")}`,
        );
      }
    }

    if (errors.length > 0) {
      console.warn("Validation errors:", errors);
      if (validatedDocuments.length === 0) {
        throw new Error(
          `All documents failed validation: ${errors.join("; ")}`,
        );
      }
    }

    console.log(
      `Inserting ${validatedDocuments.length} documents into Astra DB...`,
    );

    // Transform for Astra DB
    const astraDocuments = validatedDocuments.map((doc) => ({
      $vector: doc.embedding,
      text: doc.text,
      source: doc.source,
      category: doc.category,
      season: doc.season,
      track: doc.track,
      driver: doc.driver,
      team: doc.team,
      constructor: doc.constructor,
      position: doc.position,
      points: doc.points,
      metadata: doc.metadata,
    }));

    const result = await collection.insertMany(astraDocuments);
    console.log(`Successfully inserted ${validatedDocuments.length} documents`);

    return result.insertedIds || [];
  }

  async search(queryData: DatabaseQuery): Promise<SearchResult[]> {
    const { collection } = await this.getClient();

    const validatedQuery = DatabaseQuerySchema.parse(queryData);

    console.log(
      `🔍 Searching Astra DB: "${validatedQuery.query}" (limit: ${validatedQuery.limit})`,
    );

    const searchOptions: any = {
      sort: {
        $vector: validatedQuery.embedding,
      },
      limit: validatedQuery.limit,
    };

    // Add filters if provided
    const filter: any = {};
    if (validatedQuery.filters?.season) {
      filter.season = validatedQuery.filters.season;
    }
    if (validatedQuery.filters?.category) {
      filter.category = validatedQuery.filters.category;
    }
    if (validatedQuery.filters?.team) {
      filter.team = validatedQuery.filters.team;
    }
    if (validatedQuery.filters?.driver) {
      filter.driver = validatedQuery.filters.driver;
    }

    const query = Object.keys(filter).length > 0 ? filter : null;
    const results = await collection.find(query, searchOptions).toArray();

    // Transform results to standardized format
    const searchResults: SearchResult[] = results.map((doc: any) => ({
      id: doc._id || crypto.randomUUID(),
      text: doc.text,
      source: doc.source,
      category: doc.category,
      season: doc.season,
      track: doc.track,
      driver: doc.driver,
      team: doc.team,
      constructor: doc.constructor,
      metadata: doc.metadata,
      similarity: 1.0, // Astra DB doesn't return similarity scores directly
    }));

    console.log(`✅ Found ${searchResults.length} results in Astra DB`);
    return searchResults;
  }

  async getByFilters(filters: DocumentFilters): Promise<any[]> {
    const { collection } = await this.getClient();

    const limit = Math.min(filters.limit || 50, 100);
    const query: any = {};

    if (filters.category) query.category = filters.category;
    if (filters.season) query.season = filters.season;
    if (filters.team) query.team = filters.team;
    if (filters.driver) query.driver = filters.driver;

    const results = await collection.find(query, { limit }).toArray();
    return results;
  }

  async getStatistics(): Promise<DatabaseStatistics> {
    const { collection } = await this.getClient();

    // Get all documents to calculate statistics
    const allDocs = await collection.find(null, { limit: 10000 }).toArray();

    const categories = [
      ...new Set(allDocs.map((doc: any) => doc.category)),
    ].filter(Boolean) as string[];
    const seasons = [...new Set(allDocs.map((doc: any) => doc.season))]
      .filter(Boolean)
      .sort() as string[];
    const sources = [...new Set(allDocs.map((doc: any) => doc.source))].filter(
      Boolean,
    ) as string[];

    const documentsByCategory: Record<string, number> = {};
    const documentsBySeason: Record<string, number> = {};

    allDocs.forEach((doc: any) => {
      documentsByCategory[doc.category] =
        (documentsByCategory[doc.category] || 0) + 1;
      documentsBySeason[doc.season] = (documentsBySeason[doc.season] || 0) + 1;
    });

    return {
      totalDocuments: allDocs.length,
      categories,
      seasons,
      sources,
      documentsByCategory,
      documentsBySeason,
    };
  }

  async clear(): Promise<void> {
    const { collection } = await this.getClient();

    console.log("🗑️ Clearing all documents from Astra DB...");
    await collection.deleteMany({});
    console.log("✅ All documents cleared from Astra DB");
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const details = {
      configured: isAstraConfigured(),
      connectionWorking: false,
      tablesExist: false,
      documentsCount: 0,
      error: undefined as string | undefined,
    };

    if (!details.configured) {
      details.error = "DataStax Astra DB not configured";
      return { status: "unhealthy", details };
    }

    try {
      const { collection } = await this.getClient();

      // Test connection by counting documents
      const count = await collection.countDocuments({}, { limit: 1000 });

      details.connectionWorking = true;
      details.tablesExist = true;
      details.documentsCount = count;

      return { status: "healthy", details };
    } catch (error) {
      details.error = error instanceof Error ? error.message : String(error);
      return { status: "unhealthy", details };
    }
  }
}

// Supabase wrapper to match interface
class SupabaseProvider implements DatabaseProvider {
  name = "Supabase";

  async initialize(): Promise<void> {
    await supabaseInitialize();
  }

  async insert(documents: F1Document[]): Promise<any[]> {
    const results = await supabaseInsert(documents);
    return results;
  }

  async search(queryData: DatabaseQuery): Promise<SearchResult[]> {
    const results = await supabaseSearch(queryData);

    // Transform to standardized format
    return results.map((result) => ({
      id: result.id,
      text: result.text,
      source: result.source,
      category: result.category,
      season: result.season,
      track: result.track,
      driver: result.driver,
      team: result.team,
      constructor: result.constructor,
      metadata: result.metadata,
      similarity: result.similarity,
    }));
  }

  async getByFilters(filters: DocumentFilters): Promise<any[]> {
    return await supabaseGetByFilters(filters);
  }

  async getStatistics(): Promise<DatabaseStatistics> {
    return await supabaseGetStats();
  }

  async clear(): Promise<void> {
    await supabaseClear();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const result = await supabaseHealthCheck();

    return {
      status: result.status,
      details: {
        configured: result.details.supabaseConfigured,
        connectionWorking: result.details.connectionWorking,
        tablesExist: result.details.tablesExist,
        documentsCount: result.details.documentsCount,
        error: result.details.error,
      },
    };
  }
}

// Database provider selection
function getDatabaseProvider(): DatabaseProvider {
  if (isSupabaseConfigured() && isSupabaseAvailable()) {
    return new SupabaseProvider();
  }

  if (isAstraConfigured()) {
    return new AstraDBProvider();
  }

  throw new Error(
    "No database provider configured. Please configure either Supabase or DataStax Astra DB.",
  );
}

// Unified database interface
export class Database {
  private provider: DatabaseProvider;

  constructor() {
    this.provider = getDatabaseProvider();
    console.log(`🗄️ Using database provider: ${this.provider.name}`);
  }

  async initialize(): Promise<void> {
    return this.provider.initialize();
  }

  async insertDocuments(documents: F1Document[]): Promise<any[]> {
    return this.provider.insert(documents);
  }

  async searchDocuments(query: DatabaseQuery): Promise<SearchResult[]> {
    return this.provider.search(query);
  }

  async getDocumentsByFilters(filters: DocumentFilters): Promise<any[]> {
    return this.provider.getByFilters(filters);
  }

  async getStatistics(): Promise<DatabaseStatistics> {
    return this.provider.getStatistics();
  }

  async clearAllDocuments(): Promise<void> {
    return this.provider.clear();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.provider.healthCheck();
  }

  getProviderName(): string {
    return this.provider.name;
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

// Legacy functions for backward compatibility
export async function createCollection() {
  const db = getDatabase();
  await db.initialize();
}

export async function uploadData(
  documents: Array<{
    $vector: number[];
    text: string;
    [key: string]: any;
  }>,
) {
  const db = getDatabase();

  // Transform legacy format to F1Document format
  const f1Documents: F1Document[] = documents.map((doc) => ({
    text: doc.text,
    embedding: doc.$vector,
    source: doc.source || "unknown",
    category: doc.category || "f1_data",
    season: doc.season || new Date().getFullYear().toString(),
    track: doc.track,
    driver: doc.driver,
    team: doc.team,
    constructor: doc.constructor as unknown as string,
    position: doc.position,
    points: doc.points,
    metadata: doc.metadata,
  }));

  return db.insertDocuments(f1Documents);
}

export async function queryDatabase(
  queryEmbedding: number[],
  limit: number = 10,
) {
  const db = getDatabase();

  const query: DatabaseQuery = {
    query: "legacy_query",
    embedding: queryEmbedding,
    limit,
    threshold: 0.7,
  };

  const results = await db.searchDocuments(query);

  // Transform back to legacy format
  return results.map((result) => ({
    text: result.text,
    source: result.source,
    category: result.category,
    season: result.season,
    track: result.track,
    driver: result.driver,
    team: result.team,
    metadata: result.metadata,
  }));
}

// Export types
export type {
  DatabaseProvider,
  SearchResult,
  DocumentFilters,
  DatabaseStatistics,
  HealthCheckResult,
};
