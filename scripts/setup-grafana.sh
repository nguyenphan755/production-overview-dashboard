#!/usr/bin/env bash
# MES Grafana — cài tự động một lệnh (Linux / macOS)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "MES Grafana setup — repo: $ROOT"
command -v node >/dev/null || { echo "Node.js required"; exit 1; }
command -v docker >/dev/null || { echo "Docker required"; exit 1; }
exec node scripts/setup-grafana.mjs "$@"
