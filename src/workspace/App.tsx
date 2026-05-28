import { DataActions } from './components/DataActions/DataActions';
import { SnippetEditor } from './components/SnippetEditor/SnippetEditor';
import { SnippetRail } from './components/SnippetRail/SnippetRail';
import { RuntimeSetup } from './components/RuntimeSetup/RuntimeSetup';
import { TrustStrip } from './components/TrustStrip/TrustStrip';
import { WorkspaceHeader } from './components/WorkspaceHeader/WorkspaceHeader';
import { openExtensionDetails } from '../chrome/extension-settings';
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
      <WorkspaceHeader
        actions={
          <DataActions
            busy={state.busy}
            exportDisabled={!state.workspace}
            onExport={state.exportWorkspace}
            onImport={(file) => void state.importWorkspaceFile(file)}
          />
        }
        workspace={state.workspace}
      />
      <TrustStrip workspace={state.workspace} />
      <div className={styles.setupSlot}>
        <RuntimeSetup
          workspace={state.workspace}
          onOpenExtensionDetails={() => void openExtensionDetails()}
        />
      </div>

      <section className={styles.body} aria-label="Snippet workspace">
        <SnippetRail
          editor={state.editor}
          snippets={state.workspace?.snippets ?? []}
          onCreate={state.clearEditor}
          onDeleteFolder={(folder) => void state.deleteFolder(folder)}
          onRenameFolder={(folder, nextFolder) =>
            void state.renameFolder(folder, nextFolder)
          }
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
          onFolderChange={state.updateEditorFolder}
          onPickBlueprintSelector={() => state.pickBlueprintSelector()}
          onTestBlueprintAutomationNode={(node) =>
            state.testBlueprintAutomationNode(node)
          }
          onTestBlueprintSelector={(selector) =>
            state.testBlueprintSelector(selector)
          }
          onSave={() => void state.saveEditor()}
          onUpdate={state.updateEditor}
        />
      </section>
    </main>
  );
}
