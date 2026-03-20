const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createChildLogger } = require('../logger');

const log = createChildLogger('log-rotator');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'agent.log');
const MAX_SIZE_MB = 50;
const MAX_ROTATED_FILES = 5;
const COMPRESS_AFTER = 2; // Compress files older than .2

/**
 * Get file size in MB
 */
function getFileSizeMB(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024);
  } catch {
    return 0;
  }
}

/**
 * Compress a file with gzip
 */
function compressFile(src, dest) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(src);
    const output = fs.createWriteStream(dest);
    const gzip = zlib.createGzip();

    input.pipe(gzip).pipe(output);
    output.on('finish', () => {
      fs.unlinkSync(src);
      resolve();
    });
    output.on('error', reject);
  });
}

/**
 * Rotate log files
 * agent.log → agent.log.1 → agent.log.2 → agent.log.2.gz → ... → deleted
 */
async function rotateLogFiles() {
  const sizeMB = getFileSizeMB(LOG_FILE);

  if (sizeMB < MAX_SIZE_MB) {
    log.info(`Log file is ${sizeMB.toFixed(1)}MB (under ${MAX_SIZE_MB}MB limit) — no rotation needed`);
    return { rotated: false, sizeMB: Math.round(sizeMB * 10) / 10 };
  }

  log.info(`Log file is ${sizeMB.toFixed(1)}MB — rotating...`);

  // Delete oldest files beyond MAX_ROTATED_FILES
  for (let i = MAX_ROTATED_FILES; i >= 1; i--) {
    const gzFile = `${LOG_FILE}.${i}.gz`;
    const plainFile = `${LOG_FILE}.${i}`;

    if (i === MAX_ROTATED_FILES) {
      // Delete the oldest
      try { fs.unlinkSync(gzFile); } catch {}
      try { fs.unlinkSync(plainFile); } catch {}
    }

    // Shift files up by 1
    if (i < MAX_ROTATED_FILES) {
      const nextGz = `${LOG_FILE}.${i + 1}.gz`;
      const nextPlain = `${LOG_FILE}.${i + 1}`;

      try {
        if (fs.existsSync(gzFile)) {
          fs.renameSync(gzFile, nextGz);
        } else if (fs.existsSync(plainFile)) {
          if (i >= COMPRESS_AFTER) {
            await compressFile(plainFile, nextGz);
          } else {
            fs.renameSync(plainFile, nextPlain);
          }
        }
      } catch (e) {
        log.warn(`Failed to shift ${plainFile}: ${e.message}`);
      }
    }
  }

  // Move current log to .1
  try {
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    // Create fresh empty log file
    fs.writeFileSync(LOG_FILE, '');
    log.info('Log rotation complete');
  } catch (e) {
    log.error(`Failed to rotate log: ${e.message}`);
    return { rotated: false, error: e.message };
  }

  // Report what we have now
  const files = [];
  for (let i = 1; i <= MAX_ROTATED_FILES; i++) {
    const gz = `${LOG_FILE}.${i}.gz`;
    const plain = `${LOG_FILE}.${i}`;
    if (fs.existsSync(gz)) files.push({ file: `agent.log.${i}.gz`, sizeMB: getFileSizeMB(gz) });
    else if (fs.existsSync(plain)) files.push({ file: `agent.log.${i}`, sizeMB: getFileSizeMB(plain) });
  }

  return { rotated: true, previousSizeMB: Math.round(sizeMB * 10) / 10, archivedFiles: files };
}

/**
 * Get log file stats
 */
function getLogStats() {
  const currentSize = getFileSizeMB(LOG_FILE);
  const archives = [];

  for (let i = 1; i <= MAX_ROTATED_FILES; i++) {
    const gz = `${LOG_FILE}.${i}.gz`;
    const plain = `${LOG_FILE}.${i}`;
    if (fs.existsSync(gz)) archives.push({ file: `agent.log.${i}.gz`, sizeMB: Math.round(getFileSizeMB(gz) * 10) / 10 });
    else if (fs.existsSync(plain)) archives.push({ file: `agent.log.${i}`, sizeMB: Math.round(getFileSizeMB(plain) * 10) / 10 });
  }

  const totalArchiveSize = archives.reduce((s, a) => s + a.sizeMB, 0);

  return {
    currentSizeMB: Math.round(currentSize * 10) / 10,
    maxSizeMB: MAX_SIZE_MB,
    needsRotation: currentSize >= MAX_SIZE_MB,
    archives,
    totalSizeMB: Math.round((currentSize + totalArchiveSize) * 10) / 10,
  };
}

// CLI mode
if (require.main === module) {
  (async () => {
    const result = await rotateLogFiles();
    console.log(JSON.stringify(result, null, 2));
  })();
}

module.exports = { rotateLogFiles, getLogStats };
