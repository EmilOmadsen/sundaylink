import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class DatabaseConnection {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  public connect(): Database.Database {
    if (this.db) {
      return this.db;
    }

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`📁 Created database directory: ${dbDir}`);
      }

      // Open database connection
      console.log(`🔌 Connecting to SQLite database: ${this.dbPath}`);
      this.db = new Database(this.dbPath);

      // Configure PRAGMAs for reliability
      console.log('⚙️ Configuring SQLite PRAGMAs...');
      
      // WAL mode for better concurrency (though we'll use single replica)
      this.db.pragma('journal_mode = WAL');
      console.log('  ✓ journal_mode = WAL');
      
      // NORMAL synchronous mode for good balance of safety/performance
      this.db.pragma('synchronous = NORMAL');
      console.log('  ✓ synchronous = NORMAL');
      
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      console.log('  ✓ foreign_keys = ON');
      
      // Additional reliability settings
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('page_size = 4096');
      
      console.log('✅ Database connection established successfully');
      
      // Log single replica warning
      console.log('⚠️ SQLite detected: ensure only 1 replica is running on Railway.');
      
      return this.db;
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  public close(): void {
    if (this.db) {
      console.log('🔌 Closing database connection...');
      this.db.close();
      this.db = null;
      console.log('✅ Database connection closed');
    }
  }

  public isConnected(): boolean {
    return this.db !== null;
  }
}

// Singleton instance
let dbConnection: DatabaseConnection | null = null;

export function getDatabaseConnection(): DatabaseConnection {
  if (!dbConnection) {
    const dbPath = process.env.DB_PATH || './db/soundlink-lite.db';
    dbConnection = new DatabaseConnection(dbPath);
  }
  return dbConnection;
}

export function getDatabase(): Database.Database {
  return getDatabaseConnection().getDatabase();
}
