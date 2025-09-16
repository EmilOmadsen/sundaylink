import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Check for required environment variables
const requiredEnvVars = ['DATABASE_PATH'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('Using default values for development...');
  
  // Set default values
  if (!process.env.DATABASE_PATH) {
    process.env.DATABASE_PATH = './db/soundlink-lite.db';
  }
}

import db from '../services/database';
import fs from 'fs';
import path from 'path';

interface Migration {
  id: number;
  name: string;
  sql: string;
}

class MigrationRunner {
  private migrationsPath = path.join(__dirname, '../../db/migrations');

  constructor() {
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private getAppliedMigrations(): number[] {
    const applied = db.prepare('SELECT id FROM migrations ORDER BY id').all() as { id: number }[];
    return applied.map(m => m.id);
  }

  private getMigrationFiles(): Migration[] {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      console.log(`Created migrations directory: ${this.migrationsPath}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${file}`);
      }

      const id = parseInt(match[1], 10);
      const name = match[2];
      const sql = fs.readFileSync(path.join(this.migrationsPath, file), 'utf8');

      return { id, name, sql };
    });
  }

  async run() {
    const appliedMigrations = this.getAppliedMigrations();
    const migrationFiles = this.getMigrationFiles();

    const pendingMigrations = migrationFiles.filter(
      migration => !appliedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} migration(s)...`);

    const insertMigration = db.prepare('INSERT INTO migrations (id, name) VALUES (?, ?)');

    for (const migration of pendingMigrations) {
      console.log(`Applying migration ${migration.id}: ${migration.name}`);
      
      try {
        db.exec(migration.sql);
        insertMigration.run(migration.id, migration.name);
        console.log(`✓ Applied migration ${migration.id}`);
      } catch (error) {
        console.error(`✗ Failed to apply migration ${migration.id}:`, error);
        process.exit(1);
      }
    }

    console.log('All migrations completed successfully');
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