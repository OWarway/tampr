import {
  PICK_BLUEPRINT_SELECTOR_MESSAGE,
  START_BLUEPRINT_CREATOR_MESSAGE,
  TEST_BLUEPRINT_SELECTOR_MESSAGE,
  type PickBlueprintSelectorResponse,
  type StartBlueprintCreatorResponse,
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
