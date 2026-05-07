/**
 * Data-quality semantics for OEE components (aligned with docs/reference/oee-rulebook-realtime-vs-settled.md).
 */

export const QualityDataQuality = {
  OK: 'OK',
  /** Phase before NG integration: Quality held at 100% with explicit flag */
  ASSUMED_100_PENDING_NG_INTEGRATION: 'ASSUMED_100_PENDING_NG_INTEGRATION',
  /** No produced quantity in scope */
  NO_PRODUCTION: 'NO_PRODUCTION',
  /** Calculation error fallback */
  ERROR_DEFAULT: 'ERROR_DEFAULT',
};

export const PerformanceDataQuality = {
  OK: 'OK',
  /** targetSpeed missing/invalid — performance defaulted to 100% until master data complete */
  MISSING_TARGET_DEFAULT_100: 'MISSING_TARGET_DEFAULT_100',
};
