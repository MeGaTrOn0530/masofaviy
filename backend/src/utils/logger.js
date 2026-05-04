const format = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const extra = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${extra}`;
};

export const logger = {
  debug(message, meta) {
    console.debug(format('debug', message, meta));
  },
  info(message, meta) {
    console.info(format('info', message, meta));
  },
  warn(message, meta) {
    console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    console.error(format('error', message, meta));
  },
};
