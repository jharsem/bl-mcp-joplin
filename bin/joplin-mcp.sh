#!/bin/sh
exec npx tsx "$(dirname "$0")/../src/mcp-server.ts"
