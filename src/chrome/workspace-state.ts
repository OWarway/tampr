import type { SnippetDraft } from '../domain/snippets';
import type {
  WorkspaceStateResponse,
  WorkspaceState,
} from '../shared/workspace-messages';

export async function getWorkspaceState(): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'workspace/get-state' });
}

export async function saveSnippetDraft(
  draft: SnippetDraft,
): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'snippets/save', draft });
}

export async function removeSnippet(
  snippetId: string,
): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'snippets/remove', snippetId });
}

export async function renameSnippetFolder(
  folder: string,
  nextFolder: string,
): Promise<WorkspaceState> {
  return sendWorkspaceMessage({
    type: 'folders/rename',
    folder,
    nextFolder,
  });
}

export async function deleteSnippetFolder(
  folder: string,
): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'folders/delete', folder });
}

export async function importSnippetExport(
  payload: unknown,
): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'snippets/import', payload });
}

async function sendWorkspaceMessage(message: unknown): Promise<WorkspaceState> {
  const response = (await chrome.runtime.sendMessage(message)) as
    | WorkspaceStateResponse
    | { ok: false; error: string };

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.state;
}
