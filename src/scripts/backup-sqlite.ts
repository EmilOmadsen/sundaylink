import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables first
dotenv.config();

class SQLiteBackup {
  private dbPath: string;

  constructor() {
    this.dbPath = process.env.DB_PATH || './db/soundlink-lite.db';
  }

  public async backup(): Promise<void> {
    console.log('💾 Starting SQLite backup...');
    console.log(`🗄️ Source database: ${this.dbPath}`);

    try {
      // Check if source database exists
      if (!fs.existsSync(this.dbPath)) {
        console.log(`⚠️ Source database not found: ${this.dbPath}`);
        console.log('💡 Skipping backup (database may not exist yet)');
        return;
      }

      // Generate backup filename with ISO date
      const now = new Date();
      const isoDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const backupPath = `${this.dbPath}.bak-${isoDate}`;

      // Check if backup already exists for today
      if (fs.existsSync(backupPath)) {
        console.log(`⚠️ Backup already exists for today: ${backupPath}`);
        console.log('💡 Skipping backup to avoid overwriting');
        return;
      }

      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`📁 Created backup directory: ${backupDir}`);
      }

      // Copy database file
      console.log(`📋 Creating backup: ${backupPath}`);
      fs.copyFileSync(this.dbPath, backupPath);

      // Get file sizes for verification
      const sourceSize = fs.statSync(this.dbPath).size;
      const backupSize = fs.statSync(backupPath).size;

      if (sourceSize === backupSize) {
        console.log(`✅ Backup completed successfully`);
        console.log(`📊 Source size: ${this.formatBytes(sourceSize)}`);
        console.log(`📊 Backup size: ${this.formatBytes(backupSize)}`);
        console.log(`💾 Backup location: ${backupPath}`);
      } else {
        console.error(`❌ Backup size mismatch!`);
        console.error(`📊 Source size: ${this.formatBytes(sourceSize)}`);
        console.error(`📊 Backup size: ${this.formatBytes(backupSize)}`);
        throw new Error('Backup verification failed');
      }
    } catch (error) {
      console.error('❌ Backup failed:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Run backup if this file is executed directly
if (require.main === module) {
  const backup = new SQLiteBackup();
  backup.backup().catch(error => {
    console.error('Backup failed:', error);
    process.exit(1);
  });
}

export default SQLiteBackup;
