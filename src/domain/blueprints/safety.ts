import { isBlueprintAutomationAction } from './actions';
import type { BlueprintAutomationNode, BlueprintNode } from './recipe';

export const BLUEPRINT_SAFETY_LEVELS = ['info', 'warning', 'danger'] as const;

export type BlueprintSafetyLevel = (typeof BLUEPRINT_SAFETY_LEVELS)[number];

export type BlueprintSafetyIssue = {
  code: string;
  level: BlueprintSafetyLevel;
  message: string;
};

const RISKY_ACTION_WORDS = [
  'buy',
  'checkout',
  'delete',
  'order',
  'pay',
  'purchase',
  'publish',
  'remove',
  'send',
  'submit',
] as const;

const SENSITIVE_FIELD_WORDS = [
  'card',
  'cvv',
  'one-time',
  'otp',
  'passcode',
  'password',
  'payment',
] as const;

export function assessBlueprintNodeSafety(
  node: BlueprintNode,
): BlueprintSafetyIssue[] {
  if (!isAutomationNode(node)) {
    return [];
  }

  const issues: BlueprintSafetyIssue[] = [];

  addSelectorIssues(node, issues);

  switch (node.type) {
    case 'wait-for-element':
      addTimeoutIssues(node, issues);
      break;
    case 'click':
      addTimeoutIssues(node, issues);
      issues.push({
        code: 'click-review',
        level: 'warning',
        message: 'Click steps should be tested on a safe page before saving.',
      });

      if (!node.requireVisible) {
        issues.push({
          code: 'click-hidden',
          level: 'danger',
          message: 'Click steps should require a visible target.',
        });
      }

      if (containsAnyWords(nodeCopy(node), RISKY_ACTION_WORDS)) {
        issues.push({
          code: 'risky-click-copy',
          level: 'danger',
          message: 'This click looks like it may submit, buy, send, or delete.',
        });
      }
      break;
    case 'set-value':
      addTimeoutIssues(node, issues);

      if (!node.requireVisible) {
        issues.push({
          code: 'set-hidden',
          level: 'warning',
          message: 'Set-value steps are safer when the field is visible.',
        });
      }

      if (!node.value.trim()) {
        issues.push({
          code: 'empty-value',
          level: 'warning',
          message: 'Set-value steps need a value before they are useful.',
        });
      }

      if (containsAnyWords(nodeCopy(node), SENSITIVE_FIELD_WORDS)) {
        issues.push({
          code: 'sensitive-field',
          level: 'danger',
          message:
            'This selector looks like a password, payment, or code field.',
        });
      }
      break;
    case 'extract-text':
      addTimeoutIssues(node, issues);
      break;
    case 'custom-code':
      addTimeoutIssues(node, issues);
      issues.push({
        code: 'custom-code-review',
        level: 'info',
        message: 'Custom code is user-authored and should be reviewed.',
      });
      break;
    case 'download-json':
      if (!node.filename.toLowerCase().endsWith('.json')) {
        issues.push({
          code: 'json-extension',
          level: 'warning',
          message: 'JSON download filenames should end with .json.',
        });
      }
      break;
  }

  return issues;
}

export function highestBlueprintSafetyLevel(
  issues: readonly BlueprintSafetyIssue[],
): BlueprintSafetyLevel | undefined {
  if (issues.some((issue) => issue.level === 'danger')) {
    return 'danger';
  }

  if (issues.some((issue) => issue.level === 'warning')) {
    return 'warning';
  }

  return issues.length > 0 ? 'info' : undefined;
}

function addSelectorIssues(
  node: BlueprintAutomationNode,
  issues: BlueprintSafetyIssue[],
): void {
  if (node.selectorMeta.matchCount === 0) {
    issues.push({
      code: 'no-selector-match',
      level: 'warning',
      message: 'Selector did not match when it was created.',
    });
  }

  if (node.selectorMeta.matchCount > 1) {
    issues.push({
      code: 'multiple-selector-matches',
      level: 'warning',
      message: `Selector matched ${node.selectorMeta.matchCount} elements when it was created.`,
    });
  }

  if (
    node.selectorMeta.usesNthOfType ||
    node.selectorMeta.strategy === 'position'
  ) {
    issues.push({
      code: 'positional-selector',
      level: 'warning',
      message: 'Positional selectors can drift when page layout changes.',
    });
  }
}

function isAutomationNode(
  node: BlueprintNode,
): node is BlueprintAutomationNode {
  return isBlueprintAutomationAction(node.type);
}

function addTimeoutIssues(
  node: Extract<BlueprintAutomationNode, { timeoutMs: number }>,
  issues: BlueprintSafetyIssue[],
): void {
  if (node.timeoutMs < 1_000) {
    issues.push({
      code: 'short-timeout',
      level: 'warning',
      message: 'Timeouts under 1 second can be flaky on real pages.',
    });
  }

  if (node.timeoutMs > 30_000) {
    issues.push({
      code: 'long-timeout',
      level: 'info',
      message: 'Long timeouts can make failed runs feel slow.',
    });
  }
}

function nodeCopy(node: BlueprintAutomationNode): string {
  return [
    node.id,
    node.label,
    node.selector,
    'value' in node ? node.value : undefined,
    'variableName' in node ? node.variableName : undefined,
    'filename' in node ? node.filename : undefined,
    'valueFrom' in node ? node.valueFrom : undefined,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function containsAnyWords(value: string, words: readonly string[]): boolean {
  return words.some((word) => value.includes(word));
}
