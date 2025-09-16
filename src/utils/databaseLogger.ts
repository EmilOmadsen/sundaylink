import Database from 'better-sqlite3';
import logger from './logger';

export class DatabaseLogger {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  // Wrap database methods with logging
  prepare(sql: string): Database.Statement {
    const startTime = Date.now();
    const statement = this.db.prepare(sql);
    
    // Log the prepared statement
    logger.debug('Database statement prepared', {
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      duration: `${Date.now() - startTime}ms`
    });

    return statement;
  }

  exec(sql: string): Database.RunResult {
    const startTime = Date.now();
    const result = this.db.exec(sql);
    const duration = Date.now() - startTime;

    logger.database(sql, duration, (result as any).changes);

    return result;
  }

  transaction(fn: () => void): Database.Transaction {
    const startTime = Date.now();
    const transaction = this.db.transaction(fn);
    
    logger.debug('Database transaction created', {
      duration: `${Date.now() - startTime}ms`
    });

    return transaction;
  }

  // Helper method to run queries with automatic logging
  run(sql: string, params?: any[]): Database.RunResult {
    const startTime = Date.now();
    const statement = this.db.prepare(sql);
    const result = params ? statement.run(...params) : statement.run();
    const duration = Date.now() - startTime;

    logger.database(sql, duration, result.changes);

    return result;
  }

  get(sql: string, params?: any[]): any {
    const startTime = Date.now();
    const statement = this.db.prepare(sql);
    const result = params ? statement.get(...params) : statement.get();
    const duration = Date.now() - startTime;

    logger.database(sql, duration, result ? 1 : 0);

    return result;
  }

  all(sql: string, params?: any[]): any[] {
    const startTime = Date.now();
    const statement = this.db.prepare(sql);
    const result = params ? statement.all(...params) : statement.all();
    const duration = Date.now() - startTime;

    logger.database(sql, duration, result.length);

    return result;
  }

  // Performance monitoring
  getPerformanceStats(): {
    totalQueries: number;
    averageQueryTime: number;
    slowestQueries: Array<{ sql: string; duration: number }>;
  } {
    // This would require implementing a query cache/tracker
    // For now, return basic stats
    return {
      totalQueries: 0,
      averageQueryTime: 0,
      slowestQueries: []
    };
  }
}

// Export a function to wrap an existing database instance
export function wrapDatabaseWithLogging(db: Database.Database): DatabaseLogger {
  return new DatabaseLogger(db);
}
