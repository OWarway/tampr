import type { WorkspaceState } from '../shared/workspace-messages';
import { runtimeActionNotice } from '../shared/runtime-trust';

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
  snippetId?: string | undefined,
): string {
  if (!workspace) {
    return fallback;
  }

  if (workspace.runtime.state === 'sync-error') {
    return runtimeActionNotice(workspace.runtime);
  }

  if (workspace.runtime.state === 'user-scripts-unavailable') {
    return runtimeActionNotice(workspace.runtime);
  }

  const skipped = snippetId
    ? workspace.runtime.skipped.find((skip) => skip.snippetId === snippetId)
    : workspace.runtime.skipped[0];

  if (skipped?.reason === 'host-access') {
    return runtimeActionNotice(workspace.runtime, skipped.reason);
  }

  if (skipped?.reason === 'invalid-matches') {
    return runtimeActionNotice(workspace.runtime, skipped.reason);
  }

  if (skipped?.reason === 'no-code') {
    return runtimeActionNotice(workspace.runtime, skipped.reason);
  }

  return fallback;
}
