import {
  CANCEL_BLUEPRINT_AUTOMATION_RUN_MESSAGE,
  PICK_BLUEPRINT_SELECTOR_MESSAGE,
  RUN_BLUEPRINT_AUTOMATION_NODE_MESSAGE,
  START_BLUEPRINT_CREATOR_MESSAGE,
  TEST_BLUEPRINT_AUTOMATION_NODE_MESSAGE,
  TEST_BLUEPRINT_SELECTOR_MESSAGE,
  type BlueprintAutomationNodeRunInput,
  type CancelBlueprintAutomationRunResponse,
  type BlueprintAutomationNodeTestInput,
  type PickBlueprintSelectorResponse,
  type RunBlueprintAutomationNodeResponse,
  type StartBlueprintCreatorResponse,
  type TestBlueprintAutomationNodeResponse,
  type TestBlueprintSelectorResponse,
} from '../shared/blueprint-messages';

export async function startBlueprintCreator(): Promise<StartBlueprintCreatorResponse> {
  const response = (await chrome.runtime.sendMessage({
    type: START_BLUEPRINT_CREATOR_MESSAGE,
  })) as StartBlueprintCreatorResponse | undefined;

  if (!response) {
    return {
      ok: false,
      error: 'Blueprint creator did not return a response.',
    };
  }

  return response;
}

export async function testBlueprintSelector(
  sourceTabId: number,
  selector: string,
): Promise<TestBlueprintSelectorResponse> {
  const response = (await chrome.runtime.sendMessage({
    type: TEST_BLUEPRINT_SELECTOR_MESSAGE,
    sourceTabId,
    selector,
  })) as TestBlueprintSelectorResponse | undefined;

  if (!response) {
    return {
      ok: false,
      error: 'Blueprint selector test did not return a response.',
    };
  }

  return response;
}

export async function testBlueprintAutomationNode(
  sourceTabId: number,
  node: BlueprintAutomationNodeTestInput,
): Promise<TestBlueprintAutomationNodeResponse> {
  const response = (await chrome.runtime.sendMessage({
    type: TEST_BLUEPRINT_AUTOMATION_NODE_MESSAGE,
    sourceTabId,
    node,
  })) as TestBlueprintAutomationNodeResponse | undefined;

  if (!response) {
    return {
      ok: false,
      error: 'Blueprint automation node test did not return a response.',
    };
  }

  return response;
}

export async function runBlueprintAutomationNode(
  sourceTabId: number,
  node: BlueprintAutomationNodeRunInput,
): Promise<RunBlueprintAutomationNodeResponse> {
  const response = (await chrome.runtime.sendMessage({
    type: RUN_BLUEPRINT_AUTOMATION_NODE_MESSAGE,
    sourceTabId,
    node,
  })) as RunBlueprintAutomationNodeResponse | undefined;

  if (!response) {
    return {
      ok: false,
      error: 'Blueprint automation node run did not return a response.',
    };
  }

  return response;
}

export async function cancelBlueprintAutomationRun(
  sourceTabId: number,
  runId: string,
): Promise<CancelBlueprintAutomationRunResponse> {
  const response = (await chrome.runtime.sendMessage({
    type: CANCEL_BLUEPRINT_AUTOMATION_RUN_MESSAGE,
    sourceTabId,
    runId,
  })) as CancelBlueprintAutomationRunResponse | undefined;

  if (!response) {
    return {
      ok: false,
      error: 'Blueprint automation run cancellation did not return a response.',
    };
  }

  return response;
}

export async function pickBlueprintSelector(
  sourceTabId: number,
): Promise<PickBlueprintSelectorResponse> {
  const response = (await chrome.runtime.sendMessage({
    type: PICK_BLUEPRINT_SELECTOR_MESSAGE,
    sourceTabId,
  })) as PickBlueprintSelectorResponse | undefined;

  if (!response) {
    return {
      ok: false,
      error: 'Blueprint selector picker did not return a response.',
    };
  }

  return response;
}
