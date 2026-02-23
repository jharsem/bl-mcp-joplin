#!/usr/bin/env npx tsx
/**
 * Joplin CLI Tool
 *
 * Quick command-line interface for creating notebooks and notes in Joplin.
 *
 * Usage:
 *   JOPLIN_TOKEN=xxx npx tsx src/cli.ts <command> [args]
 *
 * Commands:
 *   ping                              Check API connection
 *   folders                           List all notebooks
 *   notes [folder-id]                 List notes (optionally in a folder)
 *   create-folder "Name"              Create a notebook
 *   create-folder "Parent/Child"      Create nested notebooks
 *   create-note "Title" "Body" <folder-id>   Create a note
 *   create-note "Title" @file.md <folder-id> Create a note from file
 *   tree '{"A":{"B":{},"C":{}}}'      Build folder tree from JSON
 *   search "query"                    Search notes
 */

import { JoplinClient } from "./joplin-client.js";
import { readFileSync } from "fs";

const [, , command, ...rest] = process.argv;

if (!command || command === "--help" || command === "-h") {
  console.log(`
Joplin CLI Tool

Usage: JOPLIN_TOKEN=xxx npx tsx src/cli.ts <command> [args]

Commands:
  ping                                    Check API connection
  folders                                 List all notebooks
  notes [folder-id]                       List notes (optionally filtered by folder)
  create-folder "Name"                    Create a notebook
  create-folder "Parent/Child/Grandchild" Create nested notebooks (path syntax)
  create-note "Title" "Body" <folder-id>  Create a note in a folder
  create-note "Title" @file.md <folder-id>  Create a note from a markdown file
  tree '{"A":{"B":{},"C":{}}}'            Build a folder tree from JSON
  search "query"                          Full-text search

Environment:
  JOPLIN_TOKEN     API token (required - find in Joplin > Tools > Options > Web Clipper)
  JOPLIN_BASE_URL  API URL (default: http://localhost:41184)

Setup:
  1. Open Joplin Desktop
  2. Go to Tools > Options > Web Clipper
  3. Enable the Web Clipper Service
  4. Copy the API token
  `);
  process.exit(0);
}

async function main() {
  // Allow ping without token
  if (command === "ping") {
    try {
      const response = await fetch("http://localhost:41184/ping");
      const text = await response.text();
      if (text === "JoplinClipperServer") {
        console.log("Joplin API is running on port 41184");
      } else {
        console.log("Unexpected response:", text);
      }
    } catch {
      console.error(
        "Cannot connect to Joplin API.\n" +
          "Make sure Joplin is running and Web Clipper is enabled:\n" +
          "  Tools > Options > Web Clipper > Enable Web Clipper Service"
      );
      process.exit(1);
    }
    return;
  }

  const client = new JoplinClient();

  switch (command) {
    case "folders": {
      const folders = await client.listFolders();
      if (folders.length === 0) {
        console.log("No notebooks found.");
        return;
      }

      // Build tree display
      const byParent = new Map<string, typeof folders>();
      for (const f of folders) {
        const key = f.parent_id || "";
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(f);
      }

      function printTree(parentId: string, indent: string) {
        const children = byParent.get(parentId) || [];
        for (let i = 0; i < children.length; i++) {
          const f = children[i];
          const isLast = i === children.length - 1;
          const prefix = isLast ? "└── " : "├── ";
          const childIndent = isLast ? "    " : "│   ";
          console.log(`${indent}${prefix}${f.title}  (${f.id.substring(0, 8)}...)`);
          printTree(f.id, indent + childIndent);
        }
      }

      console.log("Notebooks:");
      printTree("", "");
      break;
    }

    case "notes": {
      const folderId = rest[0];
      const notes = await client.listNotes(folderId, [
        "id",
        "title",
        "parent_id",
        "updated_time",
      ]);
      if (notes.length === 0) {
        console.log("No notes found.");
        return;
      }
      console.log(`Notes${folderId ? ` in folder ${folderId.substring(0, 8)}...` : ""}:\n`);
      for (const n of notes) {
        const date = new Date(n.updated_time).toISOString().slice(0, 10);
        console.log(`  ${date}  ${n.title}  (${n.id.substring(0, 8)}...)`);
      }
      break;
    }

    case "create-folder": {
      const name = rest[0];
      if (!name) {
        console.error("Usage: create-folder <name-or-path>");
        process.exit(1);
      }

      if (name.includes("/")) {
        const folder = await client.ensureFolder(name);
        console.log(`Folder path ensured: "${name}"`);
        console.log(`  Leaf folder ID: ${folder.id}`);
      } else {
        const folder = await client.createFolder({ title: name });
        console.log(`Created folder: "${folder.title}" (${folder.id})`);
      }
      break;
    }

    case "create-note": {
      const title = rest[0];
      let body = rest[1] || "";
      const folderId = rest[2];

      if (!title || !folderId) {
        console.error(
          'Usage: create-note "Title" "Body or @file.md" <folder-id>'
        );
        process.exit(1);
      }

      // Support reading body from file with @ prefix
      if (body.startsWith("@")) {
        const filePath = body.slice(1);
        body = readFileSync(filePath, "utf-8");
      }

      const note = await client.createNote({
        title,
        body,
        parent_id: folderId,
      });
      console.log(`Created note: "${note.title}" (${note.id})`);
      break;
    }

    case "tree": {
      const treeJson = rest[0];
      if (!treeJson) {
        console.error("Usage: tree '<json>'");
        console.error('Example: tree \'{"Design":{"Components":{},"Layouts":{}},"Dev":{}}\'');
        process.exit(1);
      }

      const tree = JSON.parse(treeJson);
      const result = await client.buildFolderTree(tree);
      console.log("Created folder tree:");
      for (const [name, folder] of Object.entries(result)) {
        console.log(`  ${name}: ${folder.id}`);
      }
      break;
    }

    case "search": {
      const query = rest[0];
      if (!query) {
        console.error('Usage: search "query"');
        process.exit(1);
      }
      const results = await client.search(query);
      if (results.length === 0) {
        console.log("No results found.");
        return;
      }
      console.log(`Search results for "${query}":\n`);
      for (const r of results) {
        console.log(`  ${"title" in r ? r.title : "Untitled"}  (${r.id.substring(0, 8)}...)`);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run with --help for usage info.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
