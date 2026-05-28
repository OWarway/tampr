export const BLUEPRINT_CSS_ACTIONS = [
  'hide',
  'highlight',
  'remove-overlay',
  'sticky',
  'widen',
  'print-cleanup',
] as const;

export type BlueprintCssAction = (typeof BLUEPRINT_CSS_ACTIONS)[number];

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

export function blueprintActionDescription(action: BlueprintCssAction): string {
  return BLUEPRINT_ACTION_DEFINITIONS[action].description;
}

export function blueprintActionLabel(action: BlueprintCssAction): string {
  return BLUEPRINT_ACTION_DEFINITIONS[action].label;
}
