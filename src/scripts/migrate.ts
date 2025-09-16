import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables first
dotenv.config();

import { getDatabaseConnection } from '../utils/database';

interface Migration {
  id: number;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private dbPath: string;
  private migrationsDir: string;

  constructor() {
    this.dbPath = process.env.DB_PATH || './db/soundlink-lite.db';
    // Look for migrations in both src and dist directories
    this.migrationsDir = fs.existsSync('./src/db/migrations') 
      ? './src/db/migrations' 
      : './db/migrations';
  }

  public async run(): Promise<void> {
    console.log('🔄 Starting database migrations...');
    console.log(`📁 Migrations directory: ${this.migrationsDir}`);
    console.log(`🗄️ Database path: ${this.dbPath}`);

    try {
      // Connect to database
      const dbConnection = getDatabaseConnection();
      const db = dbConnection.connect();

      // Create migrations table if it doesn't exist
      this.createMigrationsTable(db);

      // Get all migration files
      const migrations = this.getMigrationFiles();
      console.log(`📋 Found ${migrations.length} migration files`);

      // Run migrations
      let appliedCount = 0;
      for (const migration of migrations) {
        if (await this.isMigrationApplied(db, migration.id)) {
          console.log(`⏭️ Skipping migration ${migration.id}: ${migration.filename} (already applied)`);
          continue;
        }

        console.log(`🔄 Applying migration ${migration.id}: ${migration.filename}`);
        await this.applyMigration(db, migration);
        appliedCount++;
      }

      console.log(`✅ Migrations completed: ${appliedCount} new migrations applied`);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  private createMigrationsTable(db: any): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        filename TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    db.exec(createTableSQL);
    console.log('📋 Migrations table ready');
  }

  private getMigrationFiles(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      console.log(`⚠️ Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map((filename, index) => {
      const filePath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      return {
        id: index + 1,
        filename,
        sql
      };
    });
  }

  private async isMigrationApplied(db: any, migrationId: number): Promise<boolean> {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM migrations WHERE id = ?');
    const result = stmt.get(migrationId);
    return result.count > 0;
  }

  private async applyMigration(db: any, migration: Migration): Promise<void> {
    const transaction = db.transaction(() => {
      // Execute the migration SQL
      db.exec(migration.sql);
      
      // Record the migration as applied
      const stmt = db.prepare('INSERT INTO migrations (id, filename) VALUES (?, ?)');
      stmt.run(migration.id, migration.filename);
    });

    transaction();
    console.log(`✅ Applied migration ${migration.id}: ${migration.filename}`);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.run().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export default MigrationRunner;
