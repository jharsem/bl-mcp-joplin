/**
 * Demo: Using JoplinClient to organise design files
 *
 * This creates a sample folder structure and notes for tracking design work.
 * Run with: JOPLIN_TOKEN=xxx npx tsx src/demo.ts
 */

import { JoplinClient } from "./joplin-client.js";

async function main() {
  const client = new JoplinClient();

  // 1. Check connection
  const alive = await client.ping();
  if (!alive) {
    console.error(
      "Cannot reach Joplin. Make sure:\n" +
        "  - Joplin Desktop is running\n" +
        "  - Web Clipper is enabled (Tools > Options > Web Clipper)\n"
    );
    process.exit(1);
  }
  console.log("Connected to Joplin API\n");

  // 2. Build a folder tree for design tracking
  console.log("Creating folder structure...");
  const folders = await client.buildFolderTree({
    "Design Files": {
      Components: {},
      Layouts: {},
      "Style Guide": {},
      Mockups: {},
    },
  });
  console.log("  Created folder tree\n");

  // 3. Add some sample notes
  console.log("Creating sample notes...");

  await client.createNote({
    title: "Button Component",
    body: `# Button Component

## Variants
- Primary: Blue background, white text
- Secondary: Grey background, dark text
- Danger: Red background, white text

## Sizes
- Small: 32px height
- Medium: 40px height (default)
- Large: 48px height

## Status
- [x] Design complete
- [x] Figma link added
- [ ] Dev implementation
- [ ] QA review
`,
    parent_id: folders["Components"].id,
    tags: ["design", "component"],
  });

  await client.createNote({
    title: "Dashboard Layout",
    body: `# Dashboard Layout

## Structure
- Top nav (64px fixed)
- Sidebar (280px collapsible)
- Main content (fluid)
- Footer (optional)

## Breakpoints
| Name | Width | Sidebar |
|------|-------|---------|
| Mobile | <768px | Hidden |
| Tablet | 768-1024px | Collapsed |
| Desktop | >1024px | Expanded |

## Notes
- Sidebar should persist state across sessions
- Content area uses CSS Grid for card layouts
`,
    parent_id: folders["Layouts"].id,
    tags: ["design", "layout"],
  });

  await client.createNote({
    title: "Colour Palette",
    body: `# Colour Palette

## Primary
- \`#2563EB\` - Primary Blue
- \`#1D4ED8\` - Primary Dark
- \`#3B82F6\` - Primary Light

## Neutrals
- \`#111827\` - Grey 900
- \`#374151\` - Grey 700
- \`#6B7280\` - Grey 500
- \`#D1D5DB\` - Grey 300
- \`#F3F4F6\` - Grey 100

## Semantic
- \`#10B981\` - Success
- \`#F59E0B\` - Warning
- \`#EF4444\` - Error
- \`#3B82F6\` - Info
`,
    parent_id: folders["Style Guide"].id,
    tags: ["design", "style-guide"],
  });

  console.log("  Created 3 sample notes\n");

  // 4. Show what was created
  console.log("=== Created Structure ===\n");
  const allFolders = await client.listFolders();
  for (const f of allFolders) {
    const notes = await client.listNotes(f.id, ["id", "title"]);
    const indent = f.parent_id ? "    " : "";
    console.log(`${indent}[Notebook] ${f.title}`);
    for (const n of notes) {
      console.log(`${indent}    - ${n.title}`);
    }
  }

  console.log("\nDone! Open Joplin to see the new notebooks and notes.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
