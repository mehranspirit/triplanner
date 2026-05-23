const levels = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

const output = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

const configuredLevel = (
  process.env.SERVER_LOG_LEVEL ||
  process.env.LOG_LEVEL ||
  'info'
).toLowerCase();

const currentLevel = levels[configuredLevel] ?? levels.info;

const shouldLog = (level) => currentLevel >= levels[level];

module.exports = {
  debug: (...args) => {
    if (shouldLog('debug')) output.log(...args);
  },
  info: (...args) => {
    if (shouldLog('info')) output.log(...args);
  },
  warn: (...args) => {
    if (shouldLog('warn')) output.warn(...args);
  },
  error: (...args) => {
    if (shouldLog('error')) output.error(...args);
  }
};
