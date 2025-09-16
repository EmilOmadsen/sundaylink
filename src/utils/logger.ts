import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: any;
  stack?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private logFile: string;
  private errorLogFile: string;

  constructor() {
    // Set log level from environment or default to INFO
    this.logLevel = this.getLogLevelFromEnv();
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.errorLogFile = path.join(this.logDir, 'error.log');

    // Ensure logs directory exists
    this.ensureLogDirectory();
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'TRACE': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatLogEntry(level: string, message: string, context?: any, stack?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? JSON.stringify(context, null, 2) : undefined,
      stack
    };
  }

  private writeToFile(logEntry: LogEntry, isError: boolean = false): void {
    const logString = `[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}` +
      (logEntry.context ? `\nContext: ${logEntry.context}` : '') +
      (logEntry.stack ? `\nStack: ${logEntry.stack}` : '') + '\n';

    try {
      fs.appendFileSync(isError ? this.errorLogFile : this.logFile, logString);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, levelName: string, message: string, context?: any, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const stack = error?.stack;
    const logEntry = this.formatLogEntry(levelName, message, context, stack);

    // Console output with colors
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[35m', // Magenta
      TRACE: '\x1b[90m'  // Gray
    };
    const reset = '\x1b[0m';

    const consoleMessage = `${colors[levelName as keyof typeof colors]}[${levelName}]${reset} ${message}`;
    
    if (level === LogLevel.ERROR) {
      console.error(consoleMessage);
      if (context) console.error('Context:', context);
      if (stack) console.error('Stack:', stack);
    } else if (level === LogLevel.WARN) {
      console.warn(consoleMessage);
      if (context) console.warn('Context:', context);
    } else {
      console.log(consoleMessage);
      if (context) console.log('Context:', context);
    }

    // Write to file
    this.writeToFile(logEntry, level <= LogLevel.WARN);
  }

  error(message: string, context?: any, error?: Error): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context, error);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  trace(message: string, context?: any): void {
    this.log(LogLevel.TRACE, 'TRACE', message, context);
  }

  // Convenience methods for common patterns
  request(method: string, url: string, statusCode: number, duration: number, userAgent?: string): void {
    this.info(`HTTP ${method} ${url}`, {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      userAgent: userAgent?.substring(0, 100) // Truncate long user agents
    });
  }

  database(query: string, duration: number, rowsAffected?: number): void {
    this.debug(`Database query executed`, {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''), // Truncate long queries
      duration: `${duration}ms`,
      rowsAffected
    });
  }

  spotify(operation: string, userId?: string, details?: any): void {
    this.info(`Spotify API: ${operation}`, {
      userId,
      ...details
    });
  }

  campaign(action: string, campaignId: string, details?: any): void {
    this.info(`Campaign ${action}`, {
      campaignId,
      ...details
    });
  }

  polling(cycle: string, details?: any): void {
    this.info(`Polling: ${cycle}`, details);
  }

  cleanup(action: string, details?: any): void {
    this.info(`Cleanup: ${action}`, details);
  }

  // Performance monitoring
  performance(operation: string, duration: number, details?: any): void {
    if (duration > 1000) { // Log slow operations as warnings
      this.warn(`Slow operation: ${operation}`, {
        duration: `${duration}ms`,
        ...details
      });
    } else {
      this.debug(`Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...details
      });
    }
  }

  // Get log statistics
  getLogStats(): { totalSize: number; errorCount: number; lastError?: string } {
    try {
      const stats = {
        totalSize: 0,
        errorCount: 0,
        lastError: undefined as string | undefined
      };

      if (fs.existsSync(this.logFile)) {
        const logContent = fs.readFileSync(this.logFile, 'utf8');
        stats.totalSize = Buffer.byteLength(logContent);
      }

      if (fs.existsSync(this.errorLogFile)) {
        const errorContent = fs.readFileSync(this.errorLogFile, 'utf8');
        const errorLines = errorContent.split('\n').filter(line => line.includes('[ERROR]'));
        stats.errorCount = errorLines.length;
        stats.lastError = errorLines[errorLines.length - 1] || undefined;
      }

      return stats;
    } catch (error) {
      this.error('Failed to get log stats', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { totalSize: 0, errorCount: 0 };
    }
  }

  // Clean old logs (keep last 7 days)
  cleanOldLogs(): void {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const files = [this.logFile, this.errorLogFile];
      
      files.forEach(file => {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          if (stats.mtime < sevenDaysAgo) {
            fs.unlinkSync(file);
            this.info(`Cleaned old log file: ${path.basename(file)}`);
          }
        }
      });
    } catch (error) {
      this.error('Failed to clean old logs', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

// Export singleton instance
export default new Logger();
