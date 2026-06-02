import type { BlueprintElementPick } from '../domain/blueprint-snippets';
import type { BlueprintSelectorMeta } from '../domain/blueprint-selectors';
import {
  BLUEPRINT_AUTOMATION_ACTIONS,
  type BlueprintAutomationAction,
} from '../domain/blueprints/actions';

export const START_BLUEPRINT_CREATOR_MESSAGE = 'blueprints/start-creator';
export const PICK_BLUEPRINT_SELECTOR_MESSAGE = 'blueprints/pick-selector';
export const TEST_BLUEPRINT_SELECTOR_MESSAGE = 'blueprints/test-selector';
export const TEST_BLUEPRINT_AUTOMATION_NODE_MESSAGE =
  'blueprints/test-automation-node';
export const RUN_BLUEPRINT_AUTOMATION_NODE_MESSAGE =
  'blueprints/run-automation-node';

export type BlueprintSelectorTestResult = {
  firstTagName?: string;
  matchCount: number;
  recommendation?: string;
  suggestions?: BlueprintSelectorSuggestion[];
  visibleCount: number;
};

export type BlueprintSelectorSuggestion = {
  matchCount: number;
  reason: string;
  selector: string;
  selectorMeta: BlueprintSelectorMeta;
  visibleCount: number;
};

export type BlueprintAutomationNodeTestInput = {
  code?: string;
  filename?: string;
  requireVisible?: boolean;
  selector: string;
  type: BlueprintAutomationAction;
  value?: string;
  valueFrom?: string;
  variableName?: string;
};

export type BlueprintAutomationNodeTestResult = {
  action: BlueprintAutomationAction;
  firstTagName?: string;
  issues: string[];
  matchCount: number;
  preview?: string;
  ready: boolean;
  visibleCount: number;
};

export type BlueprintAutomationNodeRunInput =
  BlueprintAutomationNodeTestInput & {
    confirmAction?: boolean;
    label?: string;
    timeoutMs?: number;
  };

export type BlueprintAutomationNodeRunResult = {
  action: BlueprintAutomationAction;
  durationMs: number;
  firstTagName?: string;
  matchCount: number;
  message: string;
  preview?: string;
  value?: string;
  variableName?: string;
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

export type TestBlueprintAutomationNodeMessage = {
  node: BlueprintAutomationNodeTestInput;
  sourceTabId: number;
  type: typeof TEST_BLUEPRINT_AUTOMATION_NODE_MESSAGE;
};

export type RunBlueprintAutomationNodeMessage = {
  node: BlueprintAutomationNodeRunInput;
  sourceTabId: number;
  type: typeof RUN_BLUEPRINT_AUTOMATION_NODE_MESSAGE;
};

export type StartBlueprintCreatorResponse =
  | {
      ok: true;
      snippetId?: string;
      status: 'cancelled' | 'continued' | 'created';
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

export type TestBlueprintAutomationNodeResponse =
  | {
      ok: true;
      result: BlueprintAutomationNodeTestResult;
    }
  | {
      error: string;
      ok: false;
    };

export type RunBlueprintAutomationNodeResponse =
  | {
      ok: true;
      result: BlueprintAutomationNodeRunResult;
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

export function isTestBlueprintAutomationNodeMessage(
  message: unknown,
): message is TestBlueprintAutomationNodeMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === TEST_BLUEPRINT_AUTOMATION_NODE_MESSAGE &&
    'sourceTabId' in message &&
    typeof message.sourceTabId === 'number' &&
    Number.isInteger(message.sourceTabId) &&
    message.sourceTabId > 0 &&
    'node' in message &&
    isAutomationNodeTestInput(message.node)
  );
}

export function isRunBlueprintAutomationNodeMessage(
  message: unknown,
): message is RunBlueprintAutomationNodeMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === RUN_BLUEPRINT_AUTOMATION_NODE_MESSAGE &&
    'sourceTabId' in message &&
    typeof message.sourceTabId === 'number' &&
    Number.isInteger(message.sourceTabId) &&
    message.sourceTabId > 0 &&
    'node' in message &&
    isAutomationNodeRunInput(message.node)
  );
}

function isAutomationNodeTestInput(
  value: unknown,
): value is BlueprintAutomationNodeTestInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (
    !('type' in value) ||
    typeof value.type !== 'string' ||
    !(BLUEPRINT_AUTOMATION_ACTIONS as readonly string[]).includes(value.type)
  ) {
    return false;
  }

  if (
    !('selector' in value) ||
    typeof value.selector !== 'string' ||
    value.selector.length > 2000
  ) {
    return false;
  }

  if (
    'requireVisible' in value &&
    value.requireVisible !== undefined &&
    typeof value.requireVisible !== 'boolean'
  ) {
    return false;
  }

  return (
    optionalString(value, 'filename', 160) &&
    optionalString(value, 'code', 10_000) &&
    optionalString(value, 'value', 10_000) &&
    optionalString(value, 'valueFrom', 80) &&
    optionalString(value, 'variableName', 80)
  );
}

function isAutomationNodeRunInput(
  value: unknown,
): value is BlueprintAutomationNodeRunInput {
  if (!isAutomationNodeTestInput(value)) {
    return false;
  }

  const timeoutMs = (value as Record<string, unknown>)['timeoutMs'];
  const confirmAction = (value as Record<string, unknown>)['confirmAction'];

  if (
    timeoutMs !== undefined &&
    (typeof timeoutMs !== 'number' ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 250 ||
      timeoutMs > 60_000)
  ) {
    return false;
  }

  if (confirmAction !== undefined && typeof confirmAction !== 'boolean') {
    return false;
  }

  return optionalString(value, 'label', 120);
}

function optionalString(
  value: object,
  key: string,
  maxLength: number,
): boolean {
  const property = (value as Record<string, unknown>)[key];

  if (property === undefined) {
    return true;
  }

  return typeof property === 'string' && property.length <= maxLength;
}
