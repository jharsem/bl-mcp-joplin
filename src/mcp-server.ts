#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { JoplinClient } from "./joplin-client.js";

const client = new JoplinClient();
const server = new McpServer({
  name: "joplin",
  version: "1.0.0",
});

// ── joplin_search ──────────────────────────────────────────────────────

server.tool(
  "joplin_search",
  "Full-text search across Joplin notes. Returns matching note ids, titles, and bodies.",
  { query: z.string().describe("Search query") },
  async ({ query }) => {
    const results = await client.search(query, "note");
    const notes = results.map((r) => ({
      id: r.id,
      title: r.title,
      body: "body" in r ? r.body : undefined,
    }));
    return { content: [{ type: "text" as const, text: JSON.stringify(notes, null, 2) }] };
  }
);

// ── joplin_read_note ───────────────────────────────────────────────────

server.tool(
  "joplin_read_note",
  "Read a Joplin note's full content by its ID.",
  { id: z.string().describe("Note ID") },
  async ({ id }) => {
    const note = await client.getNote(id, ["id", "title", "body", "parent_id", "updated_time"]);
    return { content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }] };
  }
);

// ── joplin_list_notebooks ──────────────────────────────────────────────

server.tool(
  "joplin_list_notebooks",
  "List all Joplin notebooks (folders) as a flat list with parent_id for tree reconstruction.",
  {},
  async () => {
    const folders = await client.listFolders();
    const slim = folders.map((f) => ({
      id: f.id,
      title: f.title,
      parent_id: f.parent_id,
    }));
    return { content: [{ type: "text" as const, text: JSON.stringify(slim, null, 2) }] };
  }
);

// ── joplin_list_notes ──────────────────────────────────────────────────

server.tool(
  "joplin_list_notes",
  "List notes, optionally filtered by notebook. Returns id, title, and updated_time.",
  { notebook_id: z.string().optional().describe("Notebook ID to filter by (optional)") },
  async ({ notebook_id }) => {
    const notes = await client.listNotes(notebook_id, ["id", "title", "parent_id", "updated_time"]);
    const slim = notes.map((n) => ({
      id: n.id,
      title: n.title,
      parent_id: n.parent_id,
      updated_time: n.updated_time,
    }));
    return { content: [{ type: "text" as const, text: JSON.stringify(slim, null, 2) }] };
  }
);

// ── joplin_create_notebook ─────────────────────────────────────────────

server.tool(
  "joplin_create_notebook",
  "Create a notebook. Supports nested paths like 'Work/Projects/Alpha' — intermediate folders are created automatically.",
  { title: z.string().describe("Notebook title or nested path (e.g. 'Work/Projects')") },
  async ({ title }) => {
    const folder = await client.ensureFolder(title);
    return { content: [{ type: "text" as const, text: JSON.stringify(folder, null, 2) }] };
  }
);

// ── joplin_create_note ─────────────────────────────────────────────────

server.tool(
  "joplin_create_note",
  "Create a new note in a notebook.",
  {
    title: z.string().describe("Note title"),
    body: z.string().describe("Note body (Markdown)"),
    notebook_id: z.string().describe("Target notebook ID"),
    tags: z.array(z.string()).optional().describe("Optional tags to apply"),
  },
  async ({ title, body, notebook_id, tags }) => {
    const note = await client.createNote({
      title,
      body,
      parent_id: notebook_id,
      tags,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }] };
  }
);

// ── joplin_update_note ─────────────────────────────────────────────────

server.tool(
  "joplin_update_note",
  "Update an existing note's title and/or body.",
  {
    id: z.string().describe("Note ID"),
    title: z.string().optional().describe("New title"),
    body: z.string().optional().describe("New body (Markdown)"),
  },
  async ({ id, title, body }) => {
    const updates: Record<string, string> = {};
    if (title !== undefined) updates.title = title;
    if (body !== undefined) updates.body = body;
    const note = await client.updateNote(id, updates);
    return { content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }] };
  }
);

// ── joplin_list_tags ──────────────────────────────────────────────────

server.tool(
  "joplin_list_tags",
  "List all tags in Joplin. Returns id and title for each tag.",
  {},
  async () => {
    const tags = await client.listTags();
    return { content: [{ type: "text" as const, text: JSON.stringify(tags, null, 2) }] };
  }
);

// ── joplin_get_tag_notes ─────────────────────────────────────────────

server.tool(
  "joplin_get_tag_notes",
  "List all notes that have a specific tag.",
  { tag_id: z.string().describe("Tag ID") },
  async ({ tag_id }) => {
    const notes = await client.getTagNotes(tag_id);
    return { content: [{ type: "text" as const, text: JSON.stringify(notes, null, 2) }] };
  }
);

// ── joplin_rename_tag ────────────────────────────────────────────────

server.tool(
  "joplin_rename_tag",
  "Rename an existing tag.",
  {
    tag_id: z.string().describe("Tag ID"),
    title: z.string().describe("New tag title"),
  },
  async ({ tag_id, title }) => {
    const tag = await client.updateTag(tag_id, title);
    return { content: [{ type: "text" as const, text: JSON.stringify(tag, null, 2) }] };
  }
);

// ── joplin_delete_tag ────────────────────────────────────────────────

server.tool(
  "joplin_delete_tag",
  "Delete a tag entirely. Does not delete the notes, only removes the tag.",
  { tag_id: z.string().describe("Tag ID") },
  async ({ tag_id }) => {
    await client.deleteTag(tag_id);
    return { content: [{ type: "text" as const, text: "Tag deleted successfully." }] };
  }
);

// ── joplin_tag_note ──────────────────────────────────────────────────

server.tool(
  "joplin_tag_note",
  "Add a tag to a note. Creates the tag if it doesn't exist.",
  {
    tag: z.string().describe("Tag title"),
    note_id: z.string().describe("Note ID"),
  },
  async ({ tag, note_id }) => {
    const tagId = await client.ensureTag(tag, note_id);
    return { content: [{ type: "text" as const, text: JSON.stringify({ tag_id: tagId, note_id, tagged: true }, null, 2) }] };
  }
);

// ── joplin_untag_note ────────────────────────────────────────────────

server.tool(
  "joplin_untag_note",
  "Remove a tag from a note.",
  {
    tag_id: z.string().describe("Tag ID"),
    note_id: z.string().describe("Note ID"),
  },
  async ({ tag_id, note_id }) => {
    await client.removeTagFromNote(tag_id, note_id);
    return { content: [{ type: "text" as const, text: "Tag removed from note." }] };
  }
);

// ── joplin_merge_tags ────────────────────────────────────────────────

server.tool(
  "joplin_merge_tags",
  "Merge duplicate tags: moves all notes from source tag(s) to the target tag, then deletes the source tag(s).",
  {
    target_tag_id: z.string().describe("Tag ID to keep"),
    source_tag_ids: z.array(z.string()).describe("Tag IDs to merge into target and delete"),
  },
  async ({ target_tag_id, source_tag_ids }) => {
    const moved: string[] = [];
    for (const sourceId of source_tag_ids) {
      const notes = await client.getTagNotes(sourceId);
      for (const note of notes) {
        await client.addTagToNote(target_tag_id, note.id);
        moved.push(note.id);
      }
      await client.deleteTag(sourceId);
    }
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          target_tag_id,
          deleted_tags: source_tag_ids,
          notes_retagged: moved.length,
        }, null, 2),
      }],
    };
  }
);

// ── Start ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
