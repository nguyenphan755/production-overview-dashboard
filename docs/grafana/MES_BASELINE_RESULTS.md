# MES API baseline — Speed Lab & Equipment

Generated: 2026-06-25T09:58:11.569Z
API base: `http://localhost:3001/api`
Machine: `SH-08`

## Summary

| Scenario | Span (h) | T_total parallel (ms) | Payload (KB) | segment rows |
|----------|----------|------------------------|--------------|--------------|
| A — 1 ca (current shift) | 8 | **58** | 9 | 17 |
| B — production day (yesterday) | 24 | **23** | 3 | 0 |
| C — 7 ngày (week) | 168 | **745** | 4948 | 21254 |

## Per-endpoint detail

### A — 1 ca (current shift)

- Window: `2026-06-25T07:00:00.000Z` → `2026-06-25T15:00:00.000Z`
- bucketSec: 30

| Endpoint | ms | KB | OK |
|----------|-----|-----|-----|
| `speedLabQuery` | 57 | 6 | true |
| `waterfall` | 24 | 1 | true |
| `speedHistory` | 24 | 2 | true |
| `statusHistory` | 20 | 0 | true |

### B — production day (yesterday)

- Window: `2026-06-23T23:00:00.000Z` → `2026-06-24T23:00:00.000Z`
- bucketSec: 30

| Endpoint | ms | KB | OK |
|----------|-----|-----|-----|
| `speedLabQuery` | 5 | 1 | true |
| `waterfall` | 22 | 1 | true |
| `speedHistory` | 22 | 1 | true |
| `statusHistory` | 9 | 0 | true |

### C — 7 ngày (week)

- Window: `2026-06-18T09:58:11.569Z` → `2026-06-25T09:58:11.569Z`
- bucketSec: 300

| Endpoint | ms | KB | OK |
|----------|-----|-----|-----|
| `speedLabQuery` | 721 | 4905 | true |
| `waterfall` | 745 | 1 | true |
| `speedHistory` | 566 | 41 | true |
| `statusHistory` | 7 | 1 | true |

## Grafana POC targets

| Scenario | MES T_total | Grafana target T_query |
|----------|-------------|-------------------------|
| A | 58 ms | ≤ 500 ms |
| B | 23 ms | ≤ 2000 ms |
| C | 745 ms | ≤ 2000 ms |

Re-run: `node scripts/measure-speed-lab-baseline.mjs`
Grafana SQL baseline: `node scripts/measure-grafana-query-baseline.mjs`
## Grafana SQL baseline (direct Postgres)

Generated: 2026-06-25T09:58:12.555Z
Machine: `SH-08`

| Scenario | speed_agg (ms) | status (ms) | energy (ms) | count (ms) | **Σ ms** | agg rows |
|----------|----------------|-------------|-------------|------------|----------|----------|
| shift | 94 | 5 | 3 | 1 | **103** | 7 |
| day | 1 | 1 | 0 | 0 | **2** | 7 |
| week | 270 | 1 | 1 | 38 | **310** | 81 |

Re-run: `node scripts/measure-grafana-query-baseline.mjs`
