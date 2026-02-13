type LogExtra = Record<string, unknown>;

type LogMethod = (msg: string, extra?: LogExtra) => void;

type Logger = {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
};

function writeLog(level: string, name: string, msg: string, extra: LogExtra = {}): void {
  const entry = {
    level,
    name,
    msg,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  console.log(JSON.stringify(entry));
}

export function createLogger(name: string): Logger {
  return {
    info: (msg, extra) => writeLog('info', name, msg, extra),
    warn: (msg, extra) => writeLog('warn', name, msg, extra),
    error: (msg, extra) => writeLog('error', name, msg, extra),
    debug: (msg, extra) => writeLog('debug', name, msg, extra),
  };
}

export const logger = createLogger('hotel');
