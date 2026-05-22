import { removeSnippet, upsertSnippet } from '../domain/snippet-collection';
import { SnippetSchema, type Snippet } from '../domain/snippets';
import {
  createEmptySnippetState,
  SNIPPET_STORAGE_KEY,
  SnippetStateSchema,
  type SnippetState,
} from './snippet-state';

export type StorageArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

export class SnippetRepository {
  constructor(private readonly storageArea: StorageArea) {}

  async list(): Promise<Snippet[]> {
    const state = await this.readState();
    return state.snippets;
  }

  async find(snippetId: string): Promise<Snippet | undefined> {
    const snippets = await this.list();
    return snippets.find((snippet) => snippet.id === snippetId);
  }

  async save(snippet: Snippet): Promise<Snippet[]> {
    const validSnippet = SnippetSchema.parse(snippet);
    const state = await this.readState();
    const snippets = upsertSnippet(state.snippets, validSnippet);
    await this.writeState({ ...state, snippets });
    return snippets;
  }

  async remove(snippetId: string): Promise<Snippet[]> {
    const state = await this.readState();
    const snippets = removeSnippet(state.snippets, snippetId);
    await this.writeState({ ...state, snippets });
    return snippets;
  }

  private async readState(): Promise<SnippetState> {
    const stored = await this.storageArea.get(SNIPPET_STORAGE_KEY);
    const value = stored[SNIPPET_STORAGE_KEY];

    if (value === undefined) {
      return createEmptySnippetState();
    }

    return SnippetStateSchema.parse(value);
  }

  private async writeState(state: SnippetState): Promise<void> {
    await this.storageArea.set({
      [SNIPPET_STORAGE_KEY]: SnippetStateSchema.parse(state),
    });
  }
}

export function createChromeSnippetRepository(): SnippetRepository {
  return new SnippetRepository(chrome.storage.local);
}
