import { SnippetEditor } from './components/SnippetEditor/SnippetEditor';
import { SnippetRail } from './components/SnippetRail/SnippetRail';
import { WorkspaceHeader } from './components/WorkspaceHeader/WorkspaceHeader';
import { buildPageRulePresets } from '../domain/page-rule-presets';
import { getWorkspaceSourcePageUrl } from '../shared/workspace-source-page';
import { useWorkspace } from './hooks/use-workspace';

import styles from './App.module.scss';
import './workspace.scss';

export function App() {
  const state = useWorkspace();
  const pageRulePresets = buildPageRulePresets(
    getWorkspaceSourcePageUrl(window.location.href),
  );

  return (
    <main className={styles.workspace}>
      <WorkspaceHeader workspace={state.workspace} />

      <section className={styles.body} aria-label="Snippet workspace">
        <SnippetRail
          editor={state.editor}
          snippets={state.workspace?.snippets ?? []}
          onCreate={state.clearEditor}
          onSelect={state.selectEditor}
        />
        <SnippetEditor
          busy={state.busy}
          dirty={state.dirty}
          editor={state.editor}
          notice={state.notice}
          pageRulePresets={pageRulePresets}
          workspace={state.workspace}
          onDelete={() => void state.deleteEditor()}
          onDuplicate={state.duplicateCurrentEditor}
          onSave={() => void state.saveEditor()}
          onUpdate={state.updateEditor}
        />
      </section>
    </main>
  );
}
