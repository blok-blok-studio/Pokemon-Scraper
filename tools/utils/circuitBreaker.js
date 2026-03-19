const { createChildLogger } = require('../logger');

const log = createChildLogger('circuit-breaker');

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
  constructor({ name, failureThreshold = 3, resetTimeout = 300000, halfOpenMaxAttempts = 1 }) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;

    this.state = STATES.CLOSED;
    this.failures = 0;
    this.lastFailure = null;
    this.halfOpenAttempts = 0;
  }

  async execute(fn) {
    if (this.state === STATES.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = STATES.HALF_OPEN;
        this.halfOpenAttempts = 0;
        log.info(`Circuit ${this.name}: OPEN → HALF_OPEN (testing)`);
      } else {
        const waitSec = Math.ceil((this.resetTimeout - (Date.now() - this.lastFailure)) / 1000);
        throw new Error(`Circuit ${this.name} is OPEN (retry in ${waitSec}s)`);
      }
    }

    if (this.state === STATES.HALF_OPEN && this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
      throw new Error(`Circuit ${this.name} is HALF_OPEN (max test attempts reached)`);
    }

    try {
      if (this.state === STATES.HALF_OPEN) this.halfOpenAttempts++;
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      log.info(`Circuit ${this.name}: HALF_OPEN → CLOSED (recovered)`);
    }
    this.failures = 0;
    this.state = STATES.CLOSED;
    this.halfOpenAttempts = 0;
  }

  _onFailure() {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === STATES.HALF_OPEN) {
      this.state = STATES.OPEN;
      log.warn(`Circuit ${this.name}: HALF_OPEN → OPEN (test failed)`);
      return;
    }

    if (this.failures >= this.failureThreshold) {
      this.state = STATES.OPEN;
      log.warn(`Circuit ${this.name}: CLOSED → OPEN (${this.failures} failures)`);
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure ? new Date(this.lastFailure).toISOString() : null,
    };
  }

  reset() {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.lastFailure = null;
    this.halfOpenAttempts = 0;
  }
}

// Global registry of circuit breakers
const breakers = {};

function getBreaker(name, options = {}) {
  if (!breakers[name]) {
    breakers[name] = new CircuitBreaker({ name, ...options });
  }
  return breakers[name];
}

function getAllStatus() {
  const status = {};
  for (const [name, breaker] of Object.entries(breakers)) {
    status[name] = breaker.getStatus();
  }
  return status;
}

module.exports = { CircuitBreaker, getBreaker, getAllStatus, STATES };
