#!/usr/bin/env sh
# Aegis installer — installs the aegis-harness npm package globally.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/minrahim1999/aegis/main/install.sh | sh
#
# This installs the `aegis` binary globally via npm. Requires Node.js >= 22.

set -e

# --- colors (best-effort) ---
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  NC='\033[0m'
else
  GREEN=''
  YELLOW=''
  RED=''
  NC=''
fi

echo "${GREEN}Aegis installer${NC}"
echo "-----------------"

# --- check node ---
if ! command -v node >/dev/null 2>&1; then
  echo "${RED}Error: Node.js is required but not found.${NC}"
  echo "Install Node.js >= 22 from https://nodejs.org and re-run this script."
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "${YELLOW}Warning: Aegis recommends Node.js >= 22 (found $NODE_MAJOR).${NC}"
fi

# --- check npm ---
if ! command -v npm >/dev/null 2>&1; then
  echo "${RED}Error: npm is required but not found.${NC}"
  echo "Install npm (bundled with Node.js) and re-run this script."
  exit 1
fi

# --- install ---
echo "${YELLOW}Installing aegis-harness globally...${NC}"
npm install -g aegis-harness

# --- verify ---
if command -v aegis >/dev/null 2>&1; then
  echo ""
  echo "${GREEN}Aegis installed successfully!${NC}"
  echo "Run 'aegis' to start the interactive TUI."
  echo "Run 'aegis --help' for all commands."
else
  echo "${RED}Aegis installed but the 'aegis' binary was not found on PATH.${NC}"
  echo "Check your npm global bin directory and add it to PATH."
  exit 1
fi
