import {
  buildBlueprintSnippetDraft,
  type BlueprintElementPick,
} from '../domain/blueprint-snippets';
import { buildSnippet, type Snippet } from '../domain/snippets';
import type { RuntimeStatus } from '../runtime/runtime-status';
import { runTamprBlueprintPicker } from '../blueprint/blueprint-picker-script';
import {
  buildWorkspaceUrl,
  sanitizeWebPageUrl,
} from '../shared/workspace-source-page';
import type { StartBlueprintCreatorResponse } from '../shared/blueprint-messages';

type BlueprintSnippetStore = {
  save(snippet: Snippet): Promise<Snippet[]>;
};

type BlueprintRuntimeSync = (
  snippets: readonly Snippet[],
) => Promise<RuntimeStatus>;

type BlueprintTabs = Pick<typeof chrome.tabs, 'create' | 'query'>;

type BlueprintScripting = Pick<typeof chrome.scripting, 'executeScript'>;

type BlueprintControllerDependencies = {
  createId: () => string;
  getExtensionUrl: (path: string) => string;
  now: () => number;
  runtimeSync: BlueprintRuntimeSync;
  scripting: BlueprintScripting | undefined;
  snippets: BlueprintSnippetStore;
  tabs: BlueprintTabs;
};

type ActiveBlueprintTab = {
  id: number;
  pageUrl: string;
};

type BlueprintInjectionResult = {
  result?: {
    action?: 'hide' | 'highlight';
    message?: string;
    ok: boolean;
    pick?: BlueprintElementPick;
    reason?: string;
  };
};

export class BlueprintController {
  constructor(private readonly dependencies: BlueprintControllerDependencies) {}

  async startCreator(): Promise<StartBlueprintCreatorResponse> {
    try {
      return await this.createFromActiveTab();
    } catch (error: unknown) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async createFromActiveTab(): Promise<StartBlueprintCreatorResponse> {
    if (!this.dependencies.scripting) {
      throw new Error('Blueprint creator needs Chrome scripting support.');
    }

    const tab = await this.getActiveBlueprintTab();
    const [injectionResult] = (await this.dependencies.scripting.executeScript({
      target: { tabId: tab.id },
      func: runTamprBlueprintPicker,
    })) as BlueprintInjectionResult[];
    const pickerResponse = injectionResult?.result;

    if (!pickerResponse) {
      throw new Error('Blueprint creator could not read the selected element.');
    }

    if (!pickerResponse.ok) {
      return { ok: true, status: 'cancelled' };
    }

    if (!pickerResponse.action || !pickerResponse.pick) {
      throw new Error('Blueprint creator returned an incomplete selection.');
    }

    const snippetId = this.dependencies.createId();
    const snippet = buildSnippet({
      id: snippetId,
      now: this.dependencies.now(),
      draft: buildBlueprintSnippetDraft({
        action: pickerResponse.action,
        pageUrl: tab.pageUrl,
        pick: pickerResponse.pick,
      }),
    });
    const snippets = await this.dependencies.snippets.save(snippet);

    await this.dependencies.runtimeSync(snippets);
    await this.dependencies.tabs.create({
      url: buildWorkspaceUrl({
        baseUrl: this.dependencies.getExtensionUrl('workspace.html'),
        selectedSnippetId: snippetId,
        sourcePageUrl: tab.pageUrl,
      }),
    });

    return { ok: true, snippetId, status: 'created' };
  }

  private async getActiveBlueprintTab(): Promise<ActiveBlueprintTab> {
    const [tab] = await this.dependencies.tabs.query({
      active: true,
      currentWindow: true,
    });
    const pageUrl = tab?.url ? sanitizeWebPageUrl(tab.url) : undefined;

    if (!tab?.id || !pageUrl) {
      throw new Error('Blueprint creator works on http and https pages.');
    }

    return {
      id: tab.id,
      pageUrl,
    };
  }
}
