import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston that you want to link the colors
winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  }),
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport (always active in development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    }),
  );
}

// File transports
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), 'logs');

  // General log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      format: fileFormat,
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: fileFormat,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  );

  // HTTP requests log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      format: fileFormat,
      level: 'http',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    }),
  );
}

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ),
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      format: fileFormat,
    }),
  ],
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const loggerStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for different log levels
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: Error | any, meta?: any) => {
  const errorMeta = {
    ...meta,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
  };
  logger.error(message, errorMeta);
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

// Performance logging helper
export const logPerformance = (operation: string, startTime: number, meta?: any) => {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation}`, {
    ...meta,
    duration: `${duration}ms`,
    operation,
  });

  // Log slow operations as warnings
  if (duration > 1000) {
    logger.warn(`Slow operation detected: ${operation}`, {
      ...meta,
      duration: `${duration}ms`,
      threshold: '1000ms',
    });
  }
};

// Billing-specific logging helpers
export const logBillingEvent = (event: string, customerId?: string, meta?: any) => {
  logger.info(`Billing Event: ${event}`, {
    ...meta,
    event,
    customerId,
    service: 'billing',
  });
};

export const logPaymentEvent = (event: string, amount: number, currency: string, meta?: any) => {
  logger.info(`Payment Event: ${event}`, {
    ...meta,
    event,
    amount,
    currency,
    service: 'payment',
  });
};

export const logWebhookEvent = (
  eventType: string,
  eventId: string,
  processed: boolean,
  meta?: any,
) => {
  logger.info(`Webhook Event: ${eventType}`, {
    ...meta,
    eventType,
    eventId,
    processed,
    service: 'webhook',
  });
};

// Security logging
export const logSecurityEvent = (
  event: string,
  severity: 'low' | 'medium' | 'high',
  meta?: any,
) => {
  const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  logger[logLevel](`Security Event: ${event}`, {
    ...meta,
    event,
    severity,
    service: 'security',
  });
};

export default logger;
