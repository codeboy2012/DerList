/**
 * Circuit Breaker — Prevents cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through.
 * - OPEN: Too many failures, requests fail immediately.
 * - HALF_OPEN: After cooldown, allow one test request.
 *
 * Configuration per provider.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery */
  resetTimeout: number;
  /** Number of successes in half-open needed to close */
  successThreshold: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60_000, // 1 minute
  successThreshold: 2,
};

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number;
  lastAttemptAt: number;
}

const circuits = new Map<string, CircuitEntry>();

function getCircuit(providerId: string): CircuitEntry {
  if (!circuits.has(providerId)) {
    circuits.set(providerId, {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailureAt: 0,
      lastAttemptAt: 0,
    });
  }
  return circuits.get(providerId)!;
}

/**
 * Check if the circuit allows a request.
 */
export function canRequest(providerId: string, config = DEFAULT_CONFIG): boolean {
  const circuit = getCircuit(providerId);

  switch (circuit.state) {
    case 'closed':
      return true;
    case 'open': {
      // Check if reset timeout has elapsed
      if (Date.now() - circuit.lastFailureAt >= config.resetTimeout) {
        circuit.state = 'half-open';
        circuit.successes = 0;
        return true;
      }
      return false;
    }
    case 'half-open':
      return true;
  }
}

/**
 * Record a successful request.
 */
export function recordSuccess(providerId: string, config = DEFAULT_CONFIG): void {
  const circuit = getCircuit(providerId);
  circuit.lastAttemptAt = Date.now();

  switch (circuit.state) {
    case 'closed':
      circuit.failures = 0;
      break;
    case 'half-open':
      circuit.successes++;
      if (circuit.successes >= config.successThreshold) {
        circuit.state = 'closed';
        circuit.failures = 0;
      }
      break;
    case 'open':
      // Shouldn't happen, but reset
      circuit.state = 'closed';
      circuit.failures = 0;
      break;
  }
}

/**
 * Record a failed request.
 */
export function recordFailure(providerId: string, config = DEFAULT_CONFIG): void {
  const circuit = getCircuit(providerId);
  circuit.failures++;
  circuit.lastFailureAt = Date.now();
  circuit.lastAttemptAt = Date.now();

  switch (circuit.state) {
    case 'closed':
      if (circuit.failures >= config.failureThreshold) {
        circuit.state = 'open';
      }
      break;
    case 'half-open':
      // Single failure in half-open → reopen
      circuit.state = 'open';
      break;
    case 'open':
      break;
  }
}

/**
 * Get the current state of a provider's circuit.
 */
export function getCircuitState(providerId: string): CircuitState {
  return getCircuit(providerId).state;
}

/**
 * Reset a circuit (e.g., after manual intervention).
 */
export function resetCircuit(providerId: string): void {
  circuits.delete(providerId);
}
