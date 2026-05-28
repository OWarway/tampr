import type { BlueprintElementPick } from '../domain/blueprint-snippets';

export const START_BLUEPRINT_CREATOR_MESSAGE = 'blueprints/start-creator';
export const PICK_BLUEPRINT_SELECTOR_MESSAGE = 'blueprints/pick-selector';

export type StartBlueprintCreatorMessage = {
  type: typeof START_BLUEPRINT_CREATOR_MESSAGE;
};

export type PickBlueprintSelectorMessage = {
  sourceTabId: number;
  type: typeof PICK_BLUEPRINT_SELECTOR_MESSAGE;
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
