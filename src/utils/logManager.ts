import fs from 'fs';
import path from 'path';
import logger from './logger';

export class LogManager {
  private logDir: string;
  private maxLogSize: number; // in bytes
  private maxLogFiles: number;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5; // Keep 5 rotated files
  }

  // Rotate logs when they get too large
  rotateLogs(): void {
    try {
      const logFiles = ['app.log', 'error.log'];
      
      logFiles.forEach(logFile => {
        const filePath = path.join(this.logDir, logFile);
        
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          
          if (stats.size > this.maxLogSize) {
            this.rotateFile(filePath);
          }
        }
      });
    } catch (error) {
      logger.error('Error rotating logs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error ? error : undefined);
    }
  }

  private rotateFile(filePath: string): void {
    try {
      const fileName = path.basename(filePath);
      const dir = path.dirname(filePath);
      
      // Rotate existing files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = path.join(dir, `${fileName}.${i}`);
        const newFile = path.join(dir, `${fileName}.${i + 1}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            // Delete the oldest file
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Move current file to .1
      const rotatedFile = path.join(dir, `${fileName}.1`);
      fs.renameSync(filePath, rotatedFile);
      
      logger.info(`Log file rotated: ${fileName}`, {
        originalSize: fs.statSync(rotatedFile).size,
        maxSize: this.maxLogSize
      });
      
    } catch (error) {
      logger.error('Error rotating log file', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error ? error : undefined);
    }
  }

  // Clean old log files (older than 7 days)
  cleanOldLogs(): void {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const files = fs.readdirSync(this.logDir);
      let deletedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < sevenDaysAgo) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        logger.info(`Cleaned ${deletedCount} old log files`, {
          deletedCount,
          olderThan: '7 days'
        });
      }
      
    } catch (error) {
      logger.error('Error cleaning old logs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error ? error : undefined);
    }
  }

  // Get log statistics
  getLogStats(): {
    totalSize: number;
    fileCount: number;
    files: Array<{ name: string; size: number; modified: Date }>;
  } {
    try {
      const stats = {
        totalSize: 0,
        fileCount: 0,
        files: [] as Array<{ name: string; size: number; modified: Date }>
      };
      
      if (fs.existsSync(this.logDir)) {
        const files = fs.readdirSync(this.logDir);
        
        files.forEach(file => {
          const filePath = path.join(this.logDir, file);
          const fileStats = fs.statSync(filePath);
          
          stats.totalSize += fileStats.size;
          stats.fileCount++;
          stats.files.push({
            name: file,
            size: fileStats.size,
            modified: fileStats.mtime
          });
        });
      }
      
      return stats;
      
    } catch (error) {
      logger.error('Error getting log stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error ? error : undefined);
      
      return { totalSize: 0, fileCount: 0, files: [] };
    }
  }

  // Schedule log management tasks
  scheduleLogManagement(): void {
    // Rotate logs every hour
    setInterval(() => {
      this.rotateLogs();
    }, 60 * 60 * 1000); // 1 hour
    
    // Clean old logs daily at 3 AM
    const now = new Date();
    const nextCleanup = new Date(now);
    nextCleanup.setDate(nextCleanup.getDate() + 1);
    nextCleanup.setHours(3, 0, 0, 0);
    
    const timeUntilCleanup = nextCleanup.getTime() - now.getTime();
    
    setTimeout(() => {
      this.cleanOldLogs();
      
      // Schedule daily cleanup
      setInterval(() => {
        this.cleanOldLogs();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, timeUntilCleanup);
    
    logger.info('Log management scheduled', {
      rotationInterval: '1 hour',
      cleanupSchedule: 'daily at 3 AM',
      maxLogSize: `${this.maxLogSize / 1024 / 1024}MB`,
      maxLogFiles: this.maxLogFiles
    });
  }
}

// Export singleton instance
export default new LogManager();
