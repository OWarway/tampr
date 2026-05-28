import type { BlueprintElementPick } from '../domain/blueprint-snippets';

export const START_BLUEPRINT_CREATOR_MESSAGE = 'blueprints/start-creator';
export const PICK_BLUEPRINT_SELECTOR_MESSAGE = 'blueprints/pick-selector';
export const TEST_BLUEPRINT_SELECTOR_MESSAGE = 'blueprints/test-selector';

export type BlueprintSelectorTestResult = {
  firstTagName?: string;
  matchCount: number;
  visibleCount: number;
};

export type StartBlueprintCreatorMessage = {
  type: typeof START_BLUEPRINT_CREATOR_MESSAGE;
};

export type PickBlueprintSelectorMessage = {
  sourceTabId: number;
  type: typeof PICK_BLUEPRINT_SELECTOR_MESSAGE;
};

export type TestBlueprintSelectorMessage = {
  selector: string;
  sourceTabId: number;
  type: typeof TEST_BLUEPRINT_SELECTOR_MESSAGE;
};

export type StartBlueprintCreatorResponse =
  | {
      ok: true;
      snippetId?: string;
      status: 'cancelled' | 'created';
    }
  | {
      error: string;
      ok: false;
    };

export type PickBlueprintSelectorResponse =
  | {
      ok: true;
      pick?: BlueprintElementPick;
      status: 'cancelled' | 'picked';
    }
  | {
      error: string;
      ok: false;
    };

export type TestBlueprintSelectorResponse =
  | {
      ok: true;
      result: BlueprintSelectorTestResult;
    }
  | {
      error: string;
      ok: false;
    };

export function isStartBlueprintCreatorMessage(
  message: unknown,
): message is StartBlueprintCreatorMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === START_BLUEPRINT_CREATOR_MESSAGE
  );
}

export function isPickBlueprintSelectorMessage(
  message: unknown,
): message is PickBlueprintSelectorMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === PICK_BLUEPRINT_SELECTOR_MESSAGE &&
    'sourceTabId' in message &&
    typeof message.sourceTabId === 'number' &&
    Number.isInteger(message.sourceTabId) &&
    message.sourceTabId > 0
  );
}

export function isTestBlueprintSelectorMessage(
  message: unknown,
): message is TestBlueprintSelectorMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === TEST_BLUEPRINT_SELECTOR_MESSAGE &&
    'sourceTabId' in message &&
    typeof message.sourceTabId === 'number' &&
    Number.isInteger(message.sourceTabId) &&
    message.sourceTabId > 0 &&
    'selector' in message &&
    typeof message.selector === 'string' &&
    message.selector.trim().length > 0 &&
    message.selector.length <= 1000
  );
}
