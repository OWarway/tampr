import type { WorkspaceState } from '../shared/workspace-messages';

export function runtimeLabel(workspace: WorkspaceState | undefined): string {
  if (!workspace) {
    return 'Loading';
  }

  if (workspace.runtime.state === 'ready') {
    return `${workspace.runtime.registrations} registrations`;
  }

  return workspace.runtime.state === 'sync-error'
    ? 'Runtime error'
    : 'User Scripts unavailable';
}

export function runtimeNotice(
  workspace: WorkspaceState | undefined,
  fallback: string,
): string {
  if (workspace?.runtime.errors[0]) {
    return workspace.runtime.errors[0].message;
  }

  if (workspace?.runtime.state === 'user-scripts-unavailable') {
    return 'User Scripts are unavailable for Tampr.';
  }

  if (workspace?.runtime.skipped[0]?.reason === 'host-access') {
    return 'Host access is still needed before a matching snippet runs.';
  }

  if (workspace?.runtime.skipped[0]?.reason === 'invalid-matches') {
    return 'A saved match rule cannot be registered.';
  }

  return fallback;
}
