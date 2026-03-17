const PQueue = require('p-queue').default || require('p-queue');

const scraperQueue = new PQueue({
  concurrency: 1,
  interval: 3000,
  intervalCap: 1
});

const telegramQueue = new PQueue({
  concurrency: 1,
  interval: 1000,
  intervalCap: 1
});

module.exports = { scraperQueue, telegramQueue };
