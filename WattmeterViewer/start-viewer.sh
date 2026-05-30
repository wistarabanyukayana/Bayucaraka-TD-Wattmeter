#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8080}"

echo "Starting Wattmeter Viewer on http://localhost:${PORT}"
echo "Open that URL in Chrome or Edge."
echo "Press Ctrl+C here to stop the server."

python3 -m http.server "${PORT}" -d "${SCRIPT_DIR}"
