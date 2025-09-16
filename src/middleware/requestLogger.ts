import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface RequestWithStartTime extends Request {
  startTime?: number;
}

export function requestLogger(req: RequestWithStartTime, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  req.startTime = startTime;

  // Log the incoming request
  logger.info(`Incoming ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type')
  });

  // Override res.end to log the response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;
    
    // Log the response
    logger.request(
      req.method,
      req.path,
      res.statusCode,
      duration,
      req.get('User-Agent')
    );

    // Log errors as warnings
    if (res.statusCode >= 400) {
      logger.warn(`HTTP Error ${res.statusCode}`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    // Call the original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
}

export function errorLogger(error: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error(`Unhandled error in ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  }, error);

  // Don't call next() to prevent default error handling
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
}
