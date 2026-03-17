const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, module, ...rest }) => {
      const mod = module ? `[${module}]` : '';
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      return `${timestamp} ${level.toUpperCase()} ${mod} ${message}${extra}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'agent.log') })
  ]
});

logger.child = function (moduleName) {
  return logger.child ? winston.createLogger({
    level: logger.level,
    format: logger.format,
    defaultMeta: { module: moduleName },
    transports: logger.transports
  }) : logger;
};

// Override the default child method properly
const originalChild = winston.createLogger.prototype;
module.exports = {
  createChildLogger(moduleName) {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...rest }) => {
          const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp} ${level.toUpperCase()} [${moduleName}] ${message}${extra}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(logsDir, 'agent.log') })
      ]
    });
  },
  logger
};
