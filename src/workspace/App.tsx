import { SnippetEditor } from './components/SnippetEditor';
import { SnippetRail } from './components/SnippetRail';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { useWorkspace } from './hooks/use-workspace';

import './workspace.css';

export function App() {
  const state = useWorkspace();

  return (
    <main className="workspace">
      <WorkspaceHeader workspace={state.workspace} />

      <section className="workspace__body" aria-label="Snippet workspace">
        <SnippetRail
          editor={state.editor}
          snippets={state.workspace?.snippets ?? []}
          onCreate={state.clearEditor}
          onSelect={state.selectEditor}
        />
        <SnippetEditor
          busy={state.busy}
          editor={state.editor}
          notice={state.notice}
          workspace={state.workspace}
          onDelete={() => void state.deleteEditor()}
          onSave={() => void state.saveEditor()}
          onUpdate={state.updateEditor}
        />
      </section>
    </main>
  );
}
