import type {
  RuntimeSkipReason,
  RuntimeStatus,
} from '../runtime/runtime-status';
import type { WorkspaceState } from './workspace-messages';

export type TrustTone = 'attention' | 'danger' | 'neutral' | 'ready';

export type TrustItem = {
  detail: string;
  id: 'access' | 'data' | 'runtime';
  label: string;
  tone: TrustTone;
  value: string;
};

export function workspaceTrustItems(
  workspace: WorkspaceState | undefined,
): TrustItem[] {
  if (!workspace) {
    return [
      {
        id: 'data',
        label: 'Data',
        value: 'Loading',
        detail: 'Reading local extension storage.',
        tone: 'neutral',
      },
      {
        id: 'runtime',
        label: 'Runtime',
        value: 'Checking',
        detail: 'Verifying Chrome User Scripts support.',
        tone: 'neutral',
      },
      {
        id: 'access',
        label: 'Access',
        value: 'Pending',
        detail: 'Host permissions are checked after snippets load.',
        tone: 'neutral',
      },
    ];
  }

  return [
    dataTrustItem(workspace),
    runtimeTrustItem(workspace.runtime),
    accessTrustItem(workspace.runtime),
  ];
}

export function runtimeBadgeLabel(runtime: RuntimeStatus): string {
  if (runtime.state === 'user-scripts-unavailable') {
    return 'Setup';
  }

  return runtime.state === 'sync-error' ? 'Error' : 'Ready';
}

export function runtimeActionNotice(
  runtime: RuntimeStatus,
  skipReason?: RuntimeSkipReason | undefined,
): string {
  if (runtime.state === 'sync-error') {
    const message = runtime.errors[0]?.message;
    return message
      ? `Runtime sync failed: ${message}`
      : 'Runtime sync failed while registering a matching snippet.';
  }

  if (runtime.state === 'user-scripts-unavailable') {
    return 'Enable User Scripts for Tampr in Chrome extension details before snippets can run.';
  }

  if (skipReason === 'host-access') {
    return 'This page matches a snippet, but Chrome host access has not been granted for its rule yet.';
  }

  if (skipReason === 'invalid-matches') {
    return 'A matching snippet has a saved rule Chrome cannot register.';
  }

  if (skipReason === 'no-code') {
    return 'A matching snippet has no CSS or JavaScript yet.';
  }

  if (skipReason === 'disabled') {
    return 'A matching snippet is saved but disabled.';
  }

  return 'A matching snippet is not registered yet.';
}

function dataTrustItem(workspace: WorkspaceState): TrustItem {
  return {
    id: 'data',
    label: 'Data',
    value: `${workspace.snippets.length} local ${plural(
      workspace.snippets.length,
      'snippet',
    )}`,
    detail: 'Stored in Chrome local extension storage. Export JSON any time.',
    tone: 'ready',
  };
}

function runtimeTrustItem(runtime: RuntimeStatus): TrustItem {
  if (runtime.state === 'user-scripts-unavailable') {
    return {
      id: 'runtime',
      label: 'Runtime',
      value: 'User Scripts off',
      detail: 'Enable User Scripts for Tampr in Chrome extension details.',
      tone: 'attention',
    };
  }

  if (runtime.state === 'sync-error') {
    return {
      id: 'runtime',
      label: 'Runtime',
      value: 'Sync error',
      detail:
        runtime.errors[0]?.message ??
        'Chrome rejected at least one runtime registration.',
      tone: 'danger',
    };
  }

  const hasRegistrations = runtime.registrations > 0;

  return {
    id: 'runtime',
    label: 'Runtime',
    value: hasRegistrations ? 'Synced' : 'Ready',
    detail: hasRegistrations
      ? 'Saved local snippets are synced to Chrome runtime.'
      : 'Chrome runtime is ready for saved snippets.',
    tone: hasRegistrations ? 'ready' : 'neutral',
  };
}

function accessTrustItem(runtime: RuntimeStatus): TrustItem {
  const hostAccessCount = countSkips(runtime, 'host-access');
  const invalidRuleCount = countSkips(runtime, 'invalid-matches');
  const emptyCodeCount = countSkips(runtime, 'no-code');

  if (hostAccessCount > 0) {
    return {
      id: 'access',
      label: 'Access',
      value:
        hostAccessCount === 1
          ? '1 needs access'
          : `${hostAccessCount} need access`,
      detail: 'Save matching snippets and approve Chrome host access.',
      tone: 'attention',
    };
  }

  if (invalidRuleCount > 0) {
    return {
      id: 'access',
      label: 'Access',
      value: `${invalidRuleCount} rule ${plural(invalidRuleCount, 'issue')}`,
      detail: 'Fix invalid match rules before Chrome can register them.',
      tone: 'danger',
    };
  }

  if (emptyCodeCount > 0) {
    return {
      id: 'access',
      label: 'Access',
      value: `${emptyCodeCount} empty ${plural(emptyCodeCount, 'snippet')}`,
      detail: 'Add CSS or JavaScript before these snippets can run.',
      tone: 'attention',
    };
  }

  return {
    id: 'access',
    label: 'Access',
    value: 'Ready',
    detail: 'Granted match rules can run when their pages load.',
    tone: runtime.registrations > 0 ? 'ready' : 'neutral',
  };
}

function countSkips(runtime: RuntimeStatus, reason: RuntimeSkipReason): number {
  return runtime.skipped.filter((skip) => skip.reason === reason).length;
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
