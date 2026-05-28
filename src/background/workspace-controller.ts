import {
  buildSnippet,
  DEFAULT_SNIPPET_FOLDER,
  SnippetDraftSchema,
  type Snippet,
} from '../domain/snippets';
import {
  mergeImportedSnippets,
  parseSnippetExport,
} from '../domain/snippet-export';
import { derivePageSnippetStatus } from '../domain/page-snippet-status';
import type { RuntimeStatus } from '../runtime/runtime-status';
import {
  ExtensionMessageSchema,
  type ExtensionResponse,
  type WorkspaceState,
} from '../shared/workspace-messages';

export type WorkspaceSnippetStore = {
  list(): Promise<Snippet[]>;
  find(snippetId: string): Promise<Snippet | undefined>;
  save(snippet: Snippet): Promise<Snippet[]>;
  remove(snippetId: string): Promise<Snippet[]>;
  replaceAll(snippets: readonly Snippet[]): Promise<Snippet[]>;
};

export type WorkspaceRuntimeSync = (
  snippets: readonly Snippet[],
) => Promise<RuntimeStatus>;

type WorkspaceControllerDependencies = {
  createId: () => string;
  now: () => number;
  runtimeSync: WorkspaceRuntimeSync;
  snippets: WorkspaceSnippetStore;
};

export class WorkspaceController {
  constructor(private readonly dependencies: WorkspaceControllerDependencies) {}

  async handleMessage(message: unknown): Promise<ExtensionResponse> {
    const parsedMessage = ExtensionMessageSchema.safeParse(message);

    if (!parsedMessage.success) {
      return {
        ok: false,
        error: 'Unsupported Tampr message.',
      };
    }

    if (parsedMessage.data.type === 'workspace/get-state') {
      return {
        ok: true,
        state: await this.readState(),
      };
    }

    if (parsedMessage.data.type === 'page/get-state') {
      const snippets = await this.dependencies.snippets.list();

      return {
        ok: true,
        state: {
          ...derivePageSnippetStatus(snippets, parsedMessage.data.pageUrl),
          runtime: await this.dependencies.runtimeSync(snippets),
        },
      };
    }

    if (parsedMessage.data.type === 'snippets/remove') {
      await this.dependencies.snippets.remove(parsedMessage.data.snippetId);

      return {
        ok: true,
        state: await this.readState(),
      };
    }

    if (parsedMessage.data.type === 'snippets/set-enabled') {
      const previous = await this.dependencies.snippets.find(
        parsedMessage.data.snippetId,
      );

      if (!previous) {
        return {
          ok: false,
          error: 'Snippet not found.',
        };
      }

      await this.dependencies.snippets.save(
        buildSnippet({
          draft: {
            id: previous.id,
            name: previous.name,
            folder: previous.folder,
            enabled: parsedMessage.data.enabled,
            matches: previous.matches,
            excludeMatches: previous.excludeMatches,
            css: previous.css,
            js: previous.js,
            runAt: previous.runAt,
            world: previous.world,
            blueprint: previous.blueprint,
          },
          id: previous.id,
          now: this.dependencies.now(),
          previous,
        }),
      );

      return {
        ok: true,
        state: await this.readState(),
      };
    }

    if (parsedMessage.data.type === 'snippets/import') {
      try {
        const snippetExport = parseSnippetExport(parsedMessage.data.payload);
        const snippets = await this.dependencies.snippets.list();
        await this.dependencies.snippets.replaceAll(
          mergeImportedSnippets(snippets, snippetExport.data.snippets),
        );
      } catch (error: unknown) {
        return {
          ok: false,
          error: toErrorMessage(error),
        };
      }

      return {
        ok: true,
        state: await this.readState(),
      };
    }

    if (parsedMessage.data.type === 'folders/rename') {
      await this.updateSnippetFolders(
        parsedMessage.data.folder,
        parsedMessage.data.nextFolder,
      );

      return {
        ok: true,
        state: await this.readState(),
      };
    }

    if (parsedMessage.data.type === 'folders/delete') {
      await this.updateSnippetFolders(
        parsedMessage.data.folder,
        DEFAULT_SNIPPET_FOLDER,
      );

      return {
        ok: true,
        state: await this.readState(),
      };
    }

    const draft = SnippetDraftSchema.parse(parsedMessage.data.draft);
    const previous = draft.id
      ? await this.dependencies.snippets.find(draft.id)
      : undefined;
    const snippet = buildSnippet({
      draft,
      id: previous?.id ?? draft.id ?? this.dependencies.createId(),
      now: this.dependencies.now(),
      previous,
    });

    await this.dependencies.snippets.save(snippet);

    return {
      ok: true,
      state: await this.readState(),
    };
  }

  async syncStoredSnippets(): Promise<RuntimeStatus> {
    return this.dependencies.runtimeSync(
      await this.dependencies.snippets.list(),
    );
  }

  private async updateSnippetFolders(
    folder: string,
    nextFolder: string,
  ): Promise<void> {
    if (folder === nextFolder) {
      return;
    }

    const snippets = await this.dependencies.snippets.list();
    const now = this.dependencies.now();
    const nextSnippets = snippets.map((snippet) =>
      snippet.folder === folder
        ? { ...snippet, folder: nextFolder, updatedAt: now }
        : snippet,
    );

    if (nextSnippets.some((snippet, index) => snippet !== snippets[index])) {
      await this.dependencies.snippets.replaceAll(nextSnippets);
    }
  }

  private async readState(): Promise<WorkspaceState> {
    const snippets = await this.dependencies.snippets.list();

    return {
      snippets,
      runtime: await this.dependencies.runtimeSync(snippets),
    };
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
