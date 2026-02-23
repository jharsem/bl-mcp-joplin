# bl-mcp-joplin — Joplin MCP Server

A lightweight MCP (Model Context Protocol) server that exposes the Joplin Data API to AI assistants like Claude Code. Written in TypeScript, runs over stdio.

## What It Does

Gives Claude Code (or any MCP-compatible client) the ability to:

- **Search** notes (full-text)
- **Read** note content by ID
- **List** notebooks and notes
- **Create** notebooks (supports nested paths like `Work/Projects/Alpha`)
- **Create** and **update** notes (Markdown, with optional tags)

## Prerequisites

- **Joplin Desktop** running with the Web Clipper service enabled:
  `Tools > Options > Web Clipper > Enable Web Clipper Service`
- Copy the **API token** from the same settings page
- **Node.js** (v18+)

## Installation

```bash
git clone https://github.com/jharsem/bl-mcp-joplin.git
cd bl-mcp-joplin
npm install
```

## Claude Code Configuration

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project-level):

```json
{
  "mcpServers": {
    "joplin": {
      "command": "npx",
      "args": ["tsx", "/path/to/bl-mcp-joplin/src/mcp-server.ts"],
      "env": {
        "JOPLIN_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

Or use the shell wrapper:

```json
{
  "mcpServers": {
    "joplin": {
      "command": "/path/to/bl-mcp-joplin/bin/joplin-mcp.sh",
      "env": {
        "JOPLIN_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

## Standalone CLI

The project also includes a CLI for direct use:

```bash
JOPLIN_TOKEN=xxx npx tsx src/cli.ts ping
JOPLIN_TOKEN=xxx npx tsx src/cli.ts folders
JOPLIN_TOKEN=xxx npx tsx src/cli.ts search "query"
JOPLIN_TOKEN=xxx npx tsx src/cli.ts create-note "Title" "Body" <folder-id>
```

Run `npx tsx src/cli.ts --help` for the full command reference.

## MCP Tools Exposed

| Tool | Description |
|------|-------------|
| `joplin_search` | Full-text search across notes |
| `joplin_read_note` | Read a note by ID |
| `joplin_list_notebooks` | List all notebooks |
| `joplin_list_notes` | List notes (optionally by notebook) |
| `joplin_create_notebook` | Create notebook (supports nested paths) |
| `joplin_create_note` | Create a note with optional tags |
| `joplin_update_note` | Update a note's title/body |

## Stack

- TypeScript + [tsx](https://github.com/privatenumber/tsx) (no build step needed)
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) for MCP protocol
- [zod](https://github.com/colinhacks/zod) for tool parameter validation
- Joplin Data API (REST, localhost:41184)

## License

MIT
