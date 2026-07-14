/**
 * MoniBot Discord - Structured Logger
 * JSON-based structured logging for production observability.
 * Replaces console.log with parseable, queryable log entries.
 */

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || LOG_LEVELS.info;
const isProduction = process.env.NODE_ENV === 'production';

function formatLog(level, message, context = {}) {
  const entry = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...context,
  };

  if (isProduction) {
    return JSON.stringify(entry);
  }

  // Dev-friendly format with emojis for quick visual scanning
  const prefix = {
    debug: '🔍',
    info: '✅',
    warn: '⚠️',
    error: '❌',
    fatal: '💀',
  }[level] || '📋';

  const contextStr = Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : '';

  return `${prefix} ${message}${contextStr}`;
}

function shouldLog(level) {
  return (LOG_LEVELS[level] || 0) >= currentLevel;
}

/**
 * Creates a child logger with preset context fields.
 */
function createLogger(baseContext = {}) {
  const log = (level, message, context = {}) => {
    if (!shouldLog(level)) return;
    const output = formatLog(level, message, { ...baseContext, ...context });
    if (level === 'error' || level === 'fatal') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  };

  return {
    debug: (msg, ctx) => log('debug', msg, ctx),
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
    fatal: (msg, ctx) => log('fatal', msg, ctx),

    /**
     * Create a child logger with additional context.
     * Useful for per-request or per-module logging.
     */
    child: (childContext) => createLogger({ ...baseContext, ...childContext }),
  };
}

// Root logger instance
const logger = createLogger({ service: 'monibot-discord' });

export default logger;
export { createLogger };
