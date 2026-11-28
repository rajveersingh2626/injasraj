export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  requestId?: string;
  durationMs?: number;
}

class StructuredLogger {
  private formatLog(level: LogLevel, message: string, context?: Record<string, any>, requestId?: string, durationMs?: number): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context ? this.sanitize(context) : undefined,
      requestId,
      durationMs,
    };
  }

  private sanitize(obj: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'passcode', 'secret', 'token', 'authorization', 'apiKey'];
    const sanitized: Record<string, any> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        sanitized[key] = this.sanitize(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  public info(message: string, context?: Record<string, any>, requestId?: string): LogEntry {
    const entry = this.formatLog('info', message, context, requestId);
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(entry));
    }
    return entry;
  }

  public warn(message: string, context?: Record<string, any>, requestId?: string): LogEntry {
    const entry = this.formatLog('warn', message, context, requestId);
    if (process.env.NODE_ENV !== 'test') {
      console.warn(JSON.stringify(entry));
    }
    return entry;
  }

  public error(message: string, context?: Record<string, any>, requestId?: string): LogEntry {
    const entry = this.formatLog('error', message, context, requestId);
    if (process.env.NODE_ENV !== 'test') {
      console.error(JSON.stringify(entry));
    }
    return entry;
  }

  public debug(message: string, context?: Record<string, any>, requestId?: string): LogEntry {
    const entry = this.formatLog('debug', message, context, requestId);
    if (process.env.NODE_ENV !== 'test') {
      console.debug(JSON.stringify(entry));
    }
    return entry;
  }
}

export const logger = new StructuredLogger();
