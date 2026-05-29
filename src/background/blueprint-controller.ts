import {
  buildBlueprintFlowSnippetDraft,
  buildBlueprintSnippetDraft,
  type BlueprintAction,
  type BlueprintFlowDraftNode,
  type BlueprintElementPick,
} from '../domain/blueprint-snippets';
import { buildSnippet, type Snippet } from '../domain/snippets';
import type { RuntimeStatus } from '../runtime/runtime-status';
import { runTamprBlueprintAutomationNode } from '../blueprint/blueprint-automation-run-script';
import { runTamprBlueprintAutomationNodeTest } from '../blueprint/blueprint-automation-test-script';
import { runTamprBlueprintPicker } from '../blueprint/blueprint-picker-script';
import { runTamprBlueprintSelectorTest } from '../blueprint/blueprint-selector-test-script';
import {
  buildWorkspaceUrl,
  sanitizeWebPageUrl,
} from '../shared/workspace-source-page';
import type {
  BlueprintAutomationNodeRunInput,
  BlueprintAutomationNodeRunResult,
  BlueprintAutomationNodeTestInput,
  BlueprintAutomationNodeTestResult,
  BlueprintSelectorTestResult,
  PickBlueprintSelectorResponse,
  RunBlueprintAutomationNodeResponse,
  StartBlueprintCreatorResponse,
  TestBlueprintAutomationNodeResponse,
  TestBlueprintSelectorResponse,
} from '../shared/blueprint-messages';

type BlueprintSnippetStore = {
  save(snippet: Snippet): Promise<Snippet[]>;
};

type BlueprintRuntimeSync = (
  snippets: readonly Snippet[],
) => Promise<RuntimeStatus>;

type BlueprintTabs = Pick<typeof chrome.tabs, 'create' | 'query' | 'update'>;

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
    action?: BlueprintAction;
    message?: string;
    ok: boolean;
    pick?: BlueprintElementPick;
    reason?: string;
    draft?: {
      nodes: BlueprintFlowDraftNode[];
    };
  };
};

type BlueprintSelectorTestInjectionResult = {
  result?: {
    message?: string;
    ok: boolean;
    reason?: string;
    result?: BlueprintSelectorTestResult;
  };
};

type BlueprintAutomationNodeTestInjectionResult = {
  result?: {
    message?: string;
    ok: boolean;
    reason?: string;
    result?: BlueprintAutomationNodeTestResult;
  };
};

type BlueprintAutomationNodeRunInjectionResult = {
  result?: {
    message?: string;
    ok: boolean;
    reason?: string;
    result?: BlueprintAutomationNodeRunResult;
  };
};

type BlueprintCreateResult = {
  action?: BlueprintAction;
  pick?: BlueprintElementPick;
};

function buildSingleActionDraft(
  pickerResponse: BlueprintCreateResult,
  pageUrl: string,
) {
  if (!pickerResponse.action || !pickerResponse.pick) {
    throw new Error('Blueprint creator returned an incomplete selection.');
  }

  return buildBlueprintSnippetDraft({
    action: pickerResponse.action,
    pageUrl,
    pick: pickerResponse.pick,
  });
}

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

  async pickSelector(
    sourceTabId: number,
  ): Promise<PickBlueprintSelectorResponse> {
    try {
      return await this.pickSelectorFromTab(sourceTabId);
    } catch (error: unknown) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async testSelector(
    sourceTabId: number,
    selector: string,
  ): Promise<TestBlueprintSelectorResponse> {
    try {
      return await this.testSelectorOnTab(sourceTabId, selector);
    } catch (error: unknown) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async testAutomationNode(
    sourceTabId: number,
    node: BlueprintAutomationNodeTestInput,
  ): Promise<TestBlueprintAutomationNodeResponse> {
    try {
      return await this.testAutomationNodeOnTab(sourceTabId, node);
    } catch (error: unknown) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async runAutomationNode(
    sourceTabId: number,
    node: BlueprintAutomationNodeRunInput,
  ): Promise<RunBlueprintAutomationNodeResponse> {
    try {
      return await this.runAutomationNodeOnTab(sourceTabId, node);
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

    const snippetId = this.dependencies.createId();
    const draft = pickerResponse.draft
      ? buildBlueprintFlowSnippetDraft({
          nodes: pickerResponse.draft.nodes,
          pageUrl: tab.pageUrl,
        })
      : buildSingleActionDraft(pickerResponse, tab.pageUrl);
    const snippet = buildSnippet({
      id: snippetId,
      now: this.dependencies.now(),
      draft,
    });
    const snippets = await this.dependencies.snippets.save(snippet);

    await this.dependencies.runtimeSync(snippets);
    await this.dependencies.tabs.create({
      url: buildWorkspaceUrl({
        baseUrl: this.dependencies.getExtensionUrl('workspace.html'),
        selectedSnippetId: snippetId,
        sourcePageUrl: tab.pageUrl,
        sourceTabId: tab.id,
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

  private async pickSelectorFromTab(
    sourceTabId: number,
  ): Promise<PickBlueprintSelectorResponse> {
    if (!this.dependencies.scripting) {
      throw new Error(
        'Blueprint selector picker needs Chrome scripting support.',
      );
    }

    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) {
      throw new Error('Blueprint selector picker needs a source tab.');
    }

    await this.dependencies.tabs.update(sourceTabId, { active: true });

    const [injectionResult] = (await this.dependencies.scripting.executeScript({
      target: { tabId: sourceTabId },
      func: runTamprBlueprintPicker,
      args: [{ mode: 'selector' }],
    })) as BlueprintInjectionResult[];
    const pickerResponse = injectionResult?.result;

    if (!pickerResponse) {
      throw new Error('Blueprint selector picker could not read the page.');
    }

    if (!pickerResponse.ok) {
      return { ok: true, status: 'cancelled' };
    }

    if (!pickerResponse.pick) {
      throw new Error('Blueprint selector picker returned no selection.');
    }

    return {
      ok: true,
      pick: pickerResponse.pick,
      status: 'picked',
    };
  }

  private async testSelectorOnTab(
    sourceTabId: number,
    selector: string,
  ): Promise<TestBlueprintSelectorResponse> {
    if (!this.dependencies.scripting) {
      throw new Error(
        'Blueprint selector test needs Chrome scripting support.',
      );
    }

    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) {
      throw new Error('Blueprint selector test needs a source tab.');
    }

    if (!selector.trim() || selector.length > 1000) {
      throw new Error('Blueprint selector test needs a valid selector.');
    }

    const [injectionResult] = (await this.dependencies.scripting.executeScript({
      target: { tabId: sourceTabId },
      func: runTamprBlueprintSelectorTest,
      args: [{ selector }],
    })) as BlueprintSelectorTestInjectionResult[];
    const testResponse = injectionResult?.result;

    if (!testResponse) {
      throw new Error('Blueprint selector test could not read the page.');
    }

    if (!testResponse.ok) {
      throw new Error(
        testResponse.message ?? 'Blueprint selector test failed.',
      );
    }

    if (!testResponse.result) {
      throw new Error('Blueprint selector test returned no result.');
    }

    return {
      ok: true,
      result: testResponse.result,
    };
  }

  private async testAutomationNodeOnTab(
    sourceTabId: number,
    node: BlueprintAutomationNodeTestInput,
  ): Promise<TestBlueprintAutomationNodeResponse> {
    if (!this.dependencies.scripting) {
      throw new Error(
        'Blueprint automation node test needs Chrome scripting support.',
      );
    }

    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) {
      throw new Error('Blueprint automation node test needs a source tab.');
    }

    const [injectionResult] = (await this.dependencies.scripting.executeScript({
      target: { tabId: sourceTabId },
      func: runTamprBlueprintAutomationNodeTest,
      args: [node],
    })) as BlueprintAutomationNodeTestInjectionResult[];
    const testResponse = injectionResult?.result;

    if (!testResponse) {
      throw new Error(
        'Blueprint automation node test could not read the page.',
      );
    }

    if (!testResponse.ok) {
      throw new Error(
        testResponse.message ?? 'Blueprint automation node test failed.',
      );
    }

    if (!testResponse.result) {
      throw new Error('Blueprint automation node test returned no result.');
    }

    return {
      ok: true,
      result: testResponse.result,
    };
  }

  private async runAutomationNodeOnTab(
    sourceTabId: number,
    node: BlueprintAutomationNodeRunInput,
  ): Promise<RunBlueprintAutomationNodeResponse> {
    if (!this.dependencies.scripting) {
      throw new Error(
        'Blueprint automation node run needs Chrome scripting support.',
      );
    }

    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) {
      throw new Error('Blueprint automation node run needs a source tab.');
    }

    const [injectionResult] = (await this.dependencies.scripting.executeScript({
      target: { tabId: sourceTabId },
      func: runTamprBlueprintAutomationNode,
      args: [node],
    })) as BlueprintAutomationNodeRunInjectionResult[];
    const runResponse = injectionResult?.result;

    if (!runResponse) {
      throw new Error('Blueprint automation node run could not read the page.');
    }

    if (!runResponse.ok) {
      throw new Error(
        runResponse.message ?? 'Blueprint automation node run failed.',
      );
    }

    if (!runResponse.result) {
      throw new Error('Blueprint automation node run returned no result.');
    }

    return {
      ok: true,
      result: runResponse.result,
    };
  }
}
