export const BLUEPRINT_CSS_ACTIONS = [
  'hide',
  'highlight',
  'remove-overlay',
  'sticky',
  'widen',
  'print-cleanup',
] as const;

export const BLUEPRINT_AUTOMATION_ACTIONS = [
  'wait-for-element',
  'click',
  'set-value',
  'extract-text',
  'download-json',
] as const;

export const BLUEPRINT_NODE_TYPES = [
  ...BLUEPRINT_CSS_ACTIONS,
  ...BLUEPRINT_AUTOMATION_ACTIONS,
] as const;

export type BlueprintCssAction = (typeof BLUEPRINT_CSS_ACTIONS)[number];
export type BlueprintAutomationAction =
  (typeof BLUEPRINT_AUTOMATION_ACTIONS)[number];
export type BlueprintNodeAction = (typeof BLUEPRINT_NODE_TYPES)[number];

type BlueprintActionDefinition = {
  description: string;
  label: string;
};

const BLUEPRINT_ACTION_DEFINITIONS = {
  hide: {
    label: 'Hide',
    description: 'Removes the selected element from the page layout.',
  },
  highlight: {
    label: 'Highlight',
    description: 'Adds a visible outline around the selected element.',
  },
  'remove-overlay': {
    label: 'Remove overlay',
    description: 'Hides a selected overlay and restores page scrolling.',
  },
  sticky: {
    label: 'Make sticky',
    description:
      'Keeps the selected element pinned near the top while scrolling.',
  },
  widen: {
    label: 'Widen',
    description: 'Relaxes narrow content containers for easier reading.',
  },
  'print-cleanup': {
    label: 'Print cleanup',
    description: 'Hides the selected element only when printing.',
  },
} satisfies Record<BlueprintCssAction, BlueprintActionDefinition>;

const BLUEPRINT_AUTOMATION_ACTION_DEFINITIONS = {
  'wait-for-element': {
    label: 'Wait for element',
    description: 'Pauses the flow until the selected element appears.',
  },
  click: {
    label: 'Click',
    description: 'Clicks the selected element after safety checks pass.',
  },
  'set-value': {
    label: 'Set value',
    description: 'Types a saved value into the selected form field.',
  },
  'extract-text': {
    label: 'Extract text',
    description: 'Stores text from the selected element for later steps.',
  },
  'download-json': {
    label: 'Download JSON',
    description: 'Downloads collected automation values as a JSON file.',
  },
} satisfies Record<BlueprintAutomationAction, BlueprintActionDefinition>;

const BLUEPRINT_NODE_DEFINITIONS = {
  ...BLUEPRINT_ACTION_DEFINITIONS,
  ...BLUEPRINT_AUTOMATION_ACTION_DEFINITIONS,
} satisfies Record<BlueprintNodeAction, BlueprintActionDefinition>;

export function blueprintActionDescription(action: BlueprintCssAction): string {
  return BLUEPRINT_ACTION_DEFINITIONS[action].description;
}

export function blueprintActionLabel(action: BlueprintCssAction): string {
  return BLUEPRINT_ACTION_DEFINITIONS[action].label;
}

export function blueprintNodeDescription(action: BlueprintNodeAction): string {
  return BLUEPRINT_NODE_DEFINITIONS[action].description;
}

export function blueprintNodeLabel(action: BlueprintNodeAction): string {
  return BLUEPRINT_NODE_DEFINITIONS[action].label;
}

export function isBlueprintAutomationAction(
  action: BlueprintNodeAction,
): action is BlueprintAutomationAction {
  return (BLUEPRINT_AUTOMATION_ACTIONS as readonly string[]).includes(action);
}

export function isBlueprintCssAction(
  action: BlueprintNodeAction,
): action is BlueprintCssAction {
  return (BLUEPRINT_CSS_ACTIONS as readonly string[]).includes(action);
}
