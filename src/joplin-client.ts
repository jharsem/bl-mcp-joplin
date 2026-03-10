/**
 * Joplin API Client
 *
 * Wraps the Joplin Data API (REST) for creating/managing notebooks and notes.
 * Requires the Joplin desktop app running with the Web Clipper service enabled:
 *   Tools > Options > Web Clipper > Enable Web Clipper Service
 *
 * Set JOPLIN_TOKEN env var or pass token to constructor.
 */

const DEFAULT_BASE_URL = "http://localhost:41184";

interface JoplinFolder {
  id: string;
  title: string;
  parent_id: string;
  created_time: number;
  updated_time: number;
  children?: JoplinFolder[];
}

interface JoplinNote {
  id: string;
  title: string;
  body: string;
  parent_id: string;
  is_todo: number;
  created_time: number;
  updated_time: number;
  source_url?: string;
  markup_language?: number;
}

interface JoplinResource {
  id: string;
  title: string;
  mime: string;
  filename: string;
  size: number;
}

interface PaginatedResponse<T> {
  items: T[];
  has_more: boolean;
}

interface CreateFolderOptions {
  title: string;
  parent_id?: string;
}

interface CreateNoteOptions {
  title: string;
  body: string;
  parent_id: string;
  is_todo?: number;
  source_url?: string;
  tags?: string[];
}

interface UpdateNoteOptions {
  title?: string;
  body?: string;
  parent_id?: string;
  is_todo?: number;
}

export class JoplinClient {
  private baseUrl: string;
  private token: string;

  constructor(token?: string, baseUrl?: string) {
    this.token = token || process.env.JOPLIN_TOKEN || "";
    this.baseUrl = baseUrl || process.env.JOPLIN_BASE_URL || DEFAULT_BASE_URL;

    if (!this.token) {
      throw new Error(
        "Joplin API token required. Set JOPLIN_TOKEN env var or pass to constructor.\n" +
          "Find your token in Joplin: Tools > Options > Web Clipper"
      );
    }
  }

  // ── HTTP helpers ────────────────────────────────────────────────────

  private url(path: string, params: Record<string, string> = {}): string {
    const query = new URLSearchParams({ token: this.token, ...params });
    return `${this.baseUrl}${path}?${query}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    params: Record<string, string> = {}
  ): Promise<T> {
    const response = await fetch(this.url(path, params), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Joplin API error ${response.status}: ${body}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  // ── Connection ──────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(this.url("/ping"));
      const text = await response.text();
      return text === "JoplinClipperServer";
    } catch {
      return false;
    }
  }

  // ── Folders (Notebooks) ─────────────────────────────────────────────

  async listFolders(): Promise<JoplinFolder[]> {
    const all: JoplinFolder[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.request<PaginatedResponse<JoplinFolder>>(
        "/folders",
        {},
        { page: String(page), limit: "100" }
      );
      all.push(...result.items);
      hasMore = result.has_more;
      page++;
    }
    return all;
  }

  async getFolder(id: string): Promise<JoplinFolder> {
    return this.request<JoplinFolder>(`/folders/${id}`);
  }

  async createFolder(options: CreateFolderOptions): Promise<JoplinFolder> {
    return this.request<JoplinFolder>("/folders", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  async updateFolder(
    id: string,
    options: Partial<CreateFolderOptions>
  ): Promise<JoplinFolder> {
    return this.request<JoplinFolder>(`/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify(options),
    });
  }

  async deleteFolder(id: string, permanent = false): Promise<void> {
    await this.request(`/folders/${id}`, { method: "DELETE" }, permanent ? { permanent: "1" } : {});
  }

  /**
   * Find or create a folder by title. Supports nested paths like "Design/Components/Buttons".
   * Creates intermediate folders as needed.
   */
  async ensureFolder(path: string): Promise<JoplinFolder> {
    const parts = path.split("/").map((p) => p.trim()).filter(Boolean);
    const folders = await this.listFolders();

    let parentId = "";
    let current: JoplinFolder | undefined;

    for (const part of parts) {
      current = folders.find(
        (f) => f.title === part && f.parent_id === parentId
      );

      if (!current) {
        current = await this.createFolder({
          title: part,
          parent_id: parentId || undefined,
        });
        folders.push(current); // Add to local cache
      }

      parentId = current.id;
    }

    return current!;
  }

  // ── Notes ───────────────────────────────────────────────────────────

  async listNotes(
    folderId?: string,
    fields?: string[]
  ): Promise<JoplinNote[]> {
    const all: JoplinNote[] = [];
    let page = 1;
    let hasMore = true;
    const path = folderId ? `/folders/${folderId}/notes` : "/notes";
    const params: Record<string, string> = { limit: "100" };
    if (fields) params.fields = fields.join(",");

    while (hasMore) {
      const result = await this.request<PaginatedResponse<JoplinNote>>(
        path,
        {},
        { ...params, page: String(page) }
      );
      all.push(...result.items);
      hasMore = result.has_more;
      page++;
    }
    return all;
  }

  async getNote(
    id: string,
    fields?: string[]
  ): Promise<JoplinNote> {
    const params: Record<string, string> = {};
    if (fields) params.fields = fields.join(",");
    return this.request<JoplinNote>(`/notes/${id}`, {}, params);
  }

  async createNote(options: CreateNoteOptions): Promise<JoplinNote> {
    const { tags, ...noteData } = options;
    const note = await this.request<JoplinNote>("/notes", {
      method: "POST",
      body: JSON.stringify(noteData),
    });

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        await this.ensureTag(tag, note.id);
      }
    }

    return note;
  }

  async updateNote(id: string, options: UpdateNoteOptions): Promise<JoplinNote> {
    return this.request<JoplinNote>(`/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(options),
    });
  }

  async deleteNote(id: string, permanent = false): Promise<void> {
    await this.request(`/notes/${id}`, { method: "DELETE" }, permanent ? { permanent: "1" } : {});
  }

  /**
   * Find a note by title within a folder. Returns the first match.
   */
  async findNote(title: string, folderId?: string): Promise<JoplinNote | undefined> {
    const notes = await this.listNotes(folderId, ["id", "title", "parent_id"]);
    return notes.find((n) => n.title === title);
  }

  /**
   * Create or update a note by title within a folder.
   */
  async upsertNote(options: CreateNoteOptions): Promise<JoplinNote> {
    const existing = await this.findNote(options.title, options.parent_id);
    if (existing) {
      return this.updateNote(existing.id, {
        body: options.body,
        is_todo: options.is_todo,
      });
    }
    return this.createNote(options);
  }

  // ── Tags ────────────────────────────────────────────────────────────

  async listTags(): Promise<{ id: string; title: string }[]> {
    const all: { id: string; title: string }[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.request<PaginatedResponse<{ id: string; title: string }>>(
        "/tags",
        {},
        { page: String(page), limit: "100" }
      );
      all.push(...result.items);
      hasMore = result.has_more;
      page++;
    }
    return all;
  }

  async deleteTag(id: string): Promise<void> {
    await this.request(`/tags/${id}`, { method: "DELETE" });
  }

  async updateTag(id: string, title: string): Promise<{ id: string; title: string }> {
    return this.request<{ id: string; title: string }>(`/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title }),
    });
  }

  async getTagNotes(tagId: string): Promise<JoplinNote[]> {
    const all: JoplinNote[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.request<PaginatedResponse<JoplinNote>>(
        `/tags/${tagId}/notes`,
        {},
        { page: String(page), limit: "100", fields: "id,title,parent_id" }
      );
      all.push(...result.items);
      hasMore = result.has_more;
      page++;
    }
    return all;
  }

  async removeTagFromNote(tagId: string, noteId: string): Promise<void> {
    await this.request(`/tags/${tagId}/notes/${noteId}`, { method: "DELETE" });
  }

  async addTagToNote(tagId: string, noteId: string): Promise<void> {
    await this.request(`/tags/${tagId}/notes`, {
      method: "POST",
      body: JSON.stringify({ id: noteId }),
    }).catch(() => {}); // Ignore if already tagged
  }

  async ensureTag(tagTitle: string, noteId?: string): Promise<string> {
    const tags = await this.listTags();
    let tag = tags.find((t) => t.title === tagTitle.toLowerCase());

    if (!tag) {
      tag = await this.request<{ id: string; title: string }>("/tags", {
        method: "POST",
        body: JSON.stringify({ title: tagTitle }),
      });
    }

    if (noteId) {
      await this.request(`/tags/${tag.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ id: noteId }),
      }).catch(() => {}); // Ignore if already tagged
    }

    return tag.id;
  }

  // ── Search ──────────────────────────────────────────────────────────

  async search(
    query: string,
    type?: "note" | "folder" | "tag"
  ): Promise<(JoplinNote | JoplinFolder)[]> {
    const params: Record<string, string> = { query };
    if (type) params.type = type;
    const result = await this.request<PaginatedResponse<JoplinNote | JoplinFolder>>(
      "/search",
      {},
      params
    );
    return result.items;
  }

  // ── Batch operations ────────────────────────────────────────────────

  /**
   * Create multiple notes in a folder from an array of { title, body } objects.
   */
  async batchCreateNotes(
    folderId: string,
    notes: { title: string; body: string; tags?: string[] }[]
  ): Promise<JoplinNote[]> {
    const results: JoplinNote[] = [];
    for (const note of notes) {
      const created = await this.createNote({
        ...note,
        parent_id: folderId,
      });
      results.push(created);
    }
    return results;
  }

  /**
   * Build a nested folder structure from a tree definition.
   * Example: { "Design": { "Components": {}, "Layouts": {} }, "Dev": {} }
   */
  async buildFolderTree(
    tree: Record<string, any>,
    parentId = ""
  ): Promise<Record<string, JoplinFolder>> {
    const result: Record<string, JoplinFolder> = {};

    for (const [name, children] of Object.entries(tree)) {
      const folder = await this.createFolder({
        title: name,
        parent_id: parentId || undefined,
      });
      result[name] = folder;

      if (children && typeof children === "object" && Object.keys(children).length > 0) {
        const childResults = await this.buildFolderTree(children, folder.id);
        Object.assign(result, childResults);
      }
    }

    return result;
  }
}
