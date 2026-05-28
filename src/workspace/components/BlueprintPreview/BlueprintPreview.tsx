import { useMemo, useState } from 'react';

import { assessBlueprintSelector } from '../../../domain/blueprint-selectors';
import type { BlueprintElementPick } from '../../../domain/blueprint-snippets';
import {
  BLUEPRINT_AUTOMATION_ACTIONS,
  BLUEPRINT_CSS_ACTIONS,
  blueprintActionDescription,
  blueprintActionLabel,
  blueprintNodeDescription,
  blueprintNodeLabel,
  isBlueprintAutomationAction,
  isBlueprintCssAction,
  type BlueprintCssAction,
} from '../../../domain/blueprints/actions';
import {
  compileBlueprintJavaScript,
  compileBlueprintCss,
  isBlueprintCssInSync,
  isBlueprintJavaScriptInSync,
} from '../../../domain/blueprints/compiler';
import {
  assessBlueprintNodeSafety,
  highestBlueprintSafetyLevel,
  type BlueprintSafetyIssue,
} from '../../../domain/blueprints/safety';
import {
  getLinearBlueprintNodes,
  insertBlueprintNode,
  moveBlueprintNode,
  removeBlueprintNode,
  updateBlueprintNode,
  type MoveBlueprintNodeDirection,
  type BlueprintAutomationNode,
  type BlueprintNode,
  type BlueprintNodeType,
  type BlueprintRecipe,
} from '../../../domain/blueprints/recipe';
import type { BlueprintSelectorTestResult } from '../../../shared/blueprint-messages';

import styles from './BlueprintPreview.module.scss';

type BlueprintPreviewProps = {
  blueprint: BlueprintRecipe | undefined;
  css?: string;
  js?: string;
  onPickSelector?:
    | (() => Promise<BlueprintElementPick | undefined>)
    | undefined;
  onTestSelector?:
    | ((selector: string) => Promise<BlueprintSelectorTestResult | undefined>)
    | undefined;
  onChange?(blueprint: BlueprintRecipe, css: string, js?: string): void;
};

export function BlueprintPreview({
  blueprint,
  css,
  js,
  onPickSelector,
  onTestSelector,
  onChange,
}: BlueprintPreviewProps) {
  const nodes = useMemo(
    () => (blueprint ? getLinearBlueprintNodes(blueprint) : []),
    [blueprint],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [pickingNodeId, setPickingNodeId] = useState<string>();
  const [testingNodeId, setTestingNodeId] = useState<string>();
  const [selectorTestResults, setSelectorTestResults] = useState<
    Record<string, BlueprintSelectorTestResult>
  >({});

  if (!blueprint) {
    return null;
  }

  const recipe = blueprint;
  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const selectedNodeIndex = selectedNode
    ? nodes.findIndex((node) => node.id === selectedNode.id)
    : -1;
  const cssSourceKnown = css !== undefined;
  const jsSourceKnown = js !== undefined;
  const cssInSync = cssSourceKnown ? isBlueprintCssInSync(recipe, css) : true;
  const jsInSync = jsSourceKnown
    ? isBlueprintJavaScriptInSync(recipe, js)
    : true;
  const generatedCodeInSync = cssInSync && jsInSync;
  const editable = Boolean(onChange && cssSourceKnown && selectedNode);

  function editNode(
    nodeId: string,
    update: Parameters<typeof updateBlueprintNode>[2],
    options: { regeneratesCode: boolean },
  ): void {
    if (!onChange || css === undefined) {
      return;
    }

    if (options.regeneratesCode && !generatedCodeInSync) {
      return;
    }

    const nextBlueprint = updateBlueprintNode(recipe, nodeId, update);
    const nextCss = options.regeneratesCode
      ? compileBlueprintCss(nextBlueprint)
      : css;
    const nextJs =
      js !== undefined && options.regeneratesCode
        ? compileBlueprintJavaScript(nextBlueprint)
        : js;

    emitChange(nextBlueprint, nextCss, nextJs);
  }

  async function pickSelector(nodeId: string): Promise<void> {
    if (
      !onChange ||
      !onPickSelector ||
      css === undefined ||
      !generatedCodeInSync
    ) {
      return;
    }

    setPickingNodeId(nodeId);

    try {
      const pick = await onPickSelector();

      if (!pick) {
        return;
      }

      const nextBlueprint = updateBlueprintNode(recipe, nodeId, {
        selector: pick.selector,
        selectorMeta: pick.selectorMeta,
      });

      emitGeneratedChange(nextBlueprint);
      clearSelectorTestResult(nodeId);
    } finally {
      setPickingNodeId(undefined);
    }
  }

  async function testSelector(node: BlueprintNode): Promise<void> {
    if (!onTestSelector) {
      return;
    }

    setTestingNodeId(node.id);

    try {
      const result = await onTestSelector(node.selector);

      if (!result) {
        return;
      }

      setSelectorTestResults((currentResults) => ({
        ...currentResults,
        [node.id]: result,
      }));
    } finally {
      setTestingNodeId(undefined);
    }
  }

  function applyGeneratedBlueprint(
    nextBlueprint: BlueprintRecipe,
    nextSelectedNodeId?: string,
  ): void {
    if (!onChange || css === undefined || !generatedCodeInSync) {
      return;
    }

    if (nextSelectedNodeId) {
      setSelectedNodeId(nextSelectedNodeId);
    }

    emitGeneratedChange(nextBlueprint);
  }

  function addNode(type: BlueprintNodeType): void {
    if (!selectedNode) {
      return;
    }

    const result = insertBlueprintNode(recipe, {
      afterNodeId: selectedNode.id,
      selector: selectedNode.selector,
      selectorMeta: selectedNode.selectorMeta,
      type,
    });

    applyGeneratedBlueprint(result.recipe, result.nodeId);
  }

  function removeNode(nodeId: string): void {
    const nodeIndex = nodes.findIndex((node) => node.id === nodeId);
    const nextSelectedNodeId =
      nodes[nodeIndex - 1]?.id ?? nodes[nodeIndex + 1]?.id;

    applyGeneratedBlueprint(
      removeBlueprintNode(recipe, nodeId),
      nextSelectedNodeId,
    );
    clearSelectorTestResult(nodeId);
  }

  function moveNode(
    nodeId: string,
    direction: MoveBlueprintNodeDirection,
  ): void {
    applyGeneratedBlueprint(
      moveBlueprintNode(recipe, nodeId, direction),
      nodeId,
    );
  }

  function emitGeneratedChange(nextBlueprint: BlueprintRecipe): void {
    emitChange(
      nextBlueprint,
      compileBlueprintCss(nextBlueprint),
      js !== undefined ? compileBlueprintJavaScript(nextBlueprint) : undefined,
    );
  }

  function emitChange(
    nextBlueprint: BlueprintRecipe,
    nextCss: string,
    nextJs: string | undefined,
  ): void {
    if (!onChange) {
      return;
    }

    if (nextJs === undefined) {
      onChange(nextBlueprint, nextCss);
      return;
    }

    onChange(nextBlueprint, nextCss, nextJs);
  }

  function clearSelectorTestResult(nodeId: string): void {
    setSelectorTestResults((currentResults) => {
      const nextResults = { ...currentResults };

      delete nextResults[nodeId];

      return nextResults;
    });
  }

  return (
    <section className={styles.preview} aria-label="Blueprint preview">
      <header className={styles.header}>
        <div>
          <span>Blueprint</span>
          <strong>{recipe.name}</strong>
        </div>
        <span className={styles.count}>
          {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
        </span>
        {cssSourceKnown ? (
          <span
            className={`${styles.sourceState} ${
              generatedCodeInSync ? styles.synced : styles.changed
            }`}
          >
            {generatedCodeInSync ? 'Synced' : 'Code edited'}
          </span>
        ) : null}
      </header>

      <div
        className={`${styles.builder} ${
          editable ? styles.editableBuilder : styles.readOnlyBuilder
        }`}
      >
        {editable ? (
          <BlueprintNodeLibrary
            generatedCodeInSync={generatedCodeInSync}
            onAdd={addNode}
          />
        ) : null}

        <ol className={styles.flow}>
          {nodes.map((node, index) => (
            <BlueprintPreviewNode
              editable={editable}
              index={index}
              key={node.id}
              node={node}
              selected={node.id === selectedNode?.id}
              total={nodes.length}
              onSelect={() => setSelectedNodeId(node.id)}
            />
          ))}
        </ol>

        {editable && selectedNode ? (
          <BlueprintNodeInspector
            canMoveDown={
              selectedNodeIndex >= 0 && selectedNodeIndex < nodes.length - 1
            }
            canMoveUp={selectedNodeIndex > 0}
            generatedCodeInSync={generatedCodeInSync}
            node={selectedNode}
            canRemove={nodes.length > 1}
            onEnabledChange={(enabled) =>
              editNode(selectedNode.id, { enabled }, { regeneratesCode: true })
            }
            onLabelChange={(label) =>
              editNode(selectedNode.id, { label }, { regeneratesCode: true })
            }
            onMoveDown={() => moveNode(selectedNode.id, 'down')}
            onMoveUp={() => moveNode(selectedNode.id, 'up')}
            onFilenameChange={(filename) =>
              editNode(selectedNode.id, { filename }, { regeneratesCode: true })
            }
            onRequireVisibleChange={(requireVisible) =>
              editNode(
                selectedNode.id,
                { requireVisible },
                { regeneratesCode: true },
              )
            }
            onTimeoutChange={(timeoutMs) =>
              editNode(
                selectedNode.id,
                { timeoutMs },
                { regeneratesCode: true },
              )
            }
            onTypeChange={(type) =>
              editNode(selectedNode.id, { type }, { regeneratesCode: true })
            }
            onValueChange={(value) =>
              editNode(selectedNode.id, { value }, { regeneratesCode: true })
            }
            onValueFromChange={(valueFrom) =>
              editNode(
                selectedNode.id,
                { valueFrom },
                { regeneratesCode: true },
              )
            }
            onVariableNameChange={(variableName) =>
              editNode(
                selectedNode.id,
                { variableName },
                { regeneratesCode: true },
              )
            }
            onRemove={() => removeNode(selectedNode.id)}
            onPickSelector={
              onPickSelector
                ? () => void pickSelector(selectedNode.id)
                : undefined
            }
            onTestSelector={
              onTestSelector ? () => void testSelector(selectedNode) : undefined
            }
            pickingSelector={pickingNodeId === selectedNode.id}
            selectorTestResult={selectorTestResults[selectedNode.id]}
            testingSelector={testingNodeId === selectedNode.id}
          />
        ) : null}
      </div>
    </section>
  );
}

type BlueprintNodeLibraryProps = {
  generatedCodeInSync: boolean;
  onAdd(type: BlueprintNodeType): void;
};

function BlueprintNodeLibrary({
  generatedCodeInSync,
  onAdd,
}: BlueprintNodeLibraryProps) {
  return (
    <aside className={styles.library} aria-label="Blueprint node library">
      <header>
        <span>Library</span>
        <strong>Blueprint nodes</strong>
      </header>

      <span className={styles.libraryGroup}>CSS</span>
      <div className={styles.libraryActions}>
        {BLUEPRINT_CSS_ACTIONS.map((action) => (
          <button
            aria-label={`Add ${blueprintActionLabel(action)} node`}
            disabled={!generatedCodeInSync}
            key={action}
            title={blueprintActionDescription(action)}
            type="button"
            onClick={() => onAdd(action)}
          >
            {blueprintActionLabel(action)}
          </button>
        ))}
      </div>

      <span className={styles.libraryGroup}>Automation</span>
      <div className={styles.libraryActions}>
        {BLUEPRINT_AUTOMATION_ACTIONS.map((action) => (
          <button
            aria-label={`Add ${blueprintNodeLabel(action)} node`}
            disabled={!generatedCodeInSync}
            key={action}
            title={blueprintNodeDescription(action)}
            type="button"
            onClick={() => onAdd(action)}
          >
            {blueprintNodeLabel(action)}
          </button>
        ))}
      </div>
    </aside>
  );
}

type BlueprintPreviewNodeProps = {
  editable: boolean;
  index: number;
  node: BlueprintNode;
  selected: boolean;
  total: number;
  onSelect(): void;
};

function BlueprintPreviewNode({
  editable,
  index,
  node,
  selected,
  total,
  onSelect,
}: BlueprintPreviewNodeProps) {
  const assessment = assessBlueprintSelector(node.selectorMeta);
  const label = node.label ?? actionLabel(node.type);
  const content = (
    <>
      <span className={styles.step}>{index + 1}</span>
      <div className={styles.body}>
        <div className={styles.nodeHeader}>
          <strong>{label}</strong>
          <span className={styles.action}>{actionLabel(node.type)}</span>
        </div>
        <code>{node.selector}</code>
        <p>{assessment.detail}</p>
      </div>
      <span className={`${styles.quality} ${styles[assessment.quality]}`}>
        {qualityLabel(assessment.quality)}
      </span>
    </>
  );

  return (
    <li
      className={`${styles.node} ${index === total - 1 ? styles.lastNode : ''}`}
    >
      {editable ? (
        <button
          aria-pressed={selected}
          className={`${styles.nodeButton} ${selected ? styles.selected : ''}`}
          type="button"
          onClick={onSelect}
        >
          {content}
        </button>
      ) : (
        <div className={styles.nodeContent}>{content}</div>
      )}
    </li>
  );
}

type BlueprintNodeInspectorProps = {
  canMoveDown: boolean;
  canMoveUp: boolean;
  canRemove: boolean;
  generatedCodeInSync: boolean;
  node: BlueprintNode;
  onEnabledChange(enabled: boolean): void;
  onFilenameChange(filename: string): void;
  onLabelChange(label: string): void;
  onMoveDown(): void;
  onMoveUp(): void;
  onPickSelector?: (() => void) | undefined;
  onRequireVisibleChange(requireVisible: boolean): void;
  onRemove(): void;
  onTestSelector?: (() => void) | undefined;
  onTimeoutChange(timeoutMs: number): void;
  onTypeChange(type: BlueprintCssAction): void;
  onValueChange(value: string): void;
  onValueFromChange(valueFrom: string | null): void;
  onVariableNameChange(variableName: string): void;
  pickingSelector: boolean;
  selectorTestResult?: BlueprintSelectorTestResult | undefined;
  testingSelector: boolean;
};

function BlueprintNodeInspector({
  canMoveDown,
  canMoveUp,
  canRemove,
  generatedCodeInSync,
  node,
  onEnabledChange,
  onFilenameChange,
  onLabelChange,
  onMoveDown,
  onMoveUp,
  onPickSelector,
  onRequireVisibleChange,
  onRemove,
  onTestSelector,
  onTimeoutChange,
  onTypeChange,
  onValueChange,
  onValueFromChange,
  onVariableNameChange,
  pickingSelector,
  selectorTestResult,
  testingSelector,
}: BlueprintNodeInspectorProps) {
  const assessment = assessBlueprintSelector(node.selectorMeta);
  const label = node.label ?? actionLabel(node.type);
  const safetyIssues = isAutomationNode(node)
    ? assessBlueprintNodeSafety(node)
    : [];

  return (
    <aside className={styles.inspector} aria-label="Blueprint node inspector">
      <header>
        <span>Inspector</span>
        <strong>{label}</strong>
      </header>

      <div className={styles.selectorField}>
        <span>Action</span>
        {isBlueprintCssAction(node.type) ? (
          <select
            aria-label="Blueprint node action"
            disabled={!generatedCodeInSync}
            value={node.type}
            onChange={(event) =>
              onTypeChange(event.currentTarget.value as BlueprintCssAction)
            }
          >
            {BLUEPRINT_CSS_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {blueprintActionLabel(action)}
              </option>
            ))}
          </select>
        ) : (
          <strong className={styles.readOnlyAction}>
            {blueprintNodeLabel(node.type)}
          </strong>
        )}
        <p>{blueprintNodeDescription(node.type)}</p>
      </div>

      <label className={styles.inspectorField}>
        <span>Label</span>
        <input
          aria-label="Blueprint node label"
          value={node.label ?? ''}
          placeholder={actionLabel(node.type)}
          onChange={(event) => onLabelChange(event.currentTarget.value)}
        />
      </label>

      <label className={styles.enabledField}>
        <input
          aria-label="Enable blueprint node"
          checked={node.enabled}
          disabled={!generatedCodeInSync}
          type="checkbox"
          onChange={(event) => onEnabledChange(event.currentTarget.checked)}
        />
        <span>Enabled</span>
      </label>

      {isAutomationNode(node) ? (
        <>
          <BlueprintSafetySummary issues={safetyIssues} />
          <BlueprintAutomationSettings
            generatedCodeInSync={generatedCodeInSync}
            node={node}
            onFilenameChange={onFilenameChange}
            onRequireVisibleChange={onRequireVisibleChange}
            onTimeoutChange={onTimeoutChange}
            onValueChange={onValueChange}
            onValueFromChange={onValueFromChange}
            onVariableNameChange={onVariableNameChange}
          />
        </>
      ) : null}

      <div className={styles.selectorField}>
        <span>Flow position</span>
        <div className={styles.selectorActions}>
          <button
            className={styles.moveNode}
            disabled={!generatedCodeInSync || !canMoveUp}
            type="button"
            onClick={onMoveUp}
          >
            Move up
          </button>
          <button
            className={styles.moveNode}
            disabled={!generatedCodeInSync || !canMoveDown}
            type="button"
            onClick={onMoveDown}
          >
            Move down
          </button>
        </div>
      </div>

      <div className={styles.selectorField}>
        <span>Selector</span>
        <code>{node.selector}</code>
        <div className={styles.selectorActions}>
          {onPickSelector ? (
            <button
              className={styles.pickSelector}
              disabled={
                !generatedCodeInSync || pickingSelector || testingSelector
              }
              type="button"
              onClick={onPickSelector}
            >
              {pickingSelector ? 'Picking...' : 'Pick again'}
            </button>
          ) : null}
          {onTestSelector ? (
            <button
              className={styles.testSelector}
              disabled={pickingSelector || testingSelector}
              type="button"
              onClick={onTestSelector}
            >
              {testingSelector ? 'Testing...' : 'Test selector'}
            </button>
          ) : null}
        </div>
        {selectorTestResult ? (
          <p className={styles.selectorResult} aria-live="polite">
            {selectorTestSummary(selectorTestResult)}
          </p>
        ) : null}
      </div>

      <div className={styles.selectorField}>
        <span>Health</span>
        <strong className={`${styles.health} ${styles[assessment.quality]}`}>
          {qualityLabel(assessment.quality)}
        </strong>
      </div>

      <button
        className={styles.removeNode}
        disabled={!generatedCodeInSync || !canRemove}
        type="button"
        onClick={onRemove}
      >
        Remove node
      </button>
    </aside>
  );
}

function BlueprintSafetySummary({
  issues,
}: {
  issues: readonly BlueprintSafetyIssue[];
}) {
  const level = highestBlueprintSafetyLevel(issues);
  const label = safetyLabel(level);

  return (
    <div className={styles.safetyPanel} aria-label="Automation safety">
      <div className={styles.safetyHeader}>
        <span>Safety</span>
        <strong className={`${styles.safetyBadge} ${safetyClass(level)}`}>
          {label}
        </strong>
      </div>
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue.code}>{issue.message}</li>
          ))}
        </ul>
      ) : (
        <p>No automation warnings.</p>
      )}
    </div>
  );
}

type BlueprintAutomationSettingsProps = {
  generatedCodeInSync: boolean;
  node: BlueprintAutomationNode;
  onFilenameChange(filename: string): void;
  onRequireVisibleChange(requireVisible: boolean): void;
  onTimeoutChange(timeoutMs: number): void;
  onValueChange(value: string): void;
  onValueFromChange(valueFrom: string | null): void;
  onVariableNameChange(variableName: string): void;
};

function BlueprintAutomationSettings({
  generatedCodeInSync,
  node,
  onFilenameChange,
  onRequireVisibleChange,
  onTimeoutChange,
  onValueChange,
  onValueFromChange,
  onVariableNameChange,
}: BlueprintAutomationSettingsProps) {
  return (
    <div className={styles.automationSettings}>
      {'requireVisible' in node ? (
        <label className={styles.enabledField}>
          <input
            aria-label="Require visible element"
            checked={node.requireVisible}
            disabled={!generatedCodeInSync}
            type="checkbox"
            onChange={(event) =>
              onRequireVisibleChange(event.currentTarget.checked)
            }
          />
          <span>Require visible</span>
        </label>
      ) : null}

      {'timeoutMs' in node ? (
        <label className={styles.inspectorField}>
          <span>Timeout</span>
          <input
            aria-label="Automation timeout"
            disabled={!generatedCodeInSync}
            max={60000}
            min={250}
            step={250}
            type="number"
            value={node.timeoutMs}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;

              if (Number.isFinite(value)) {
                onTimeoutChange(clampAutomationTimeout(value));
              }
            }}
          />
        </label>
      ) : null}

      {node.type === 'set-value' ? (
        <label className={styles.inspectorField}>
          <span>Value</span>
          <input
            aria-label="Automation value"
            disabled={!generatedCodeInSync}
            value={node.value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
          />
        </label>
      ) : null}

      {node.type === 'extract-text' ? (
        <label className={styles.inspectorField}>
          <span>Variable</span>
          <input
            aria-label="Automation variable name"
            disabled={!generatedCodeInSync}
            value={node.variableName}
            onChange={(event) =>
              onVariableNameChange(event.currentTarget.value)
            }
          />
        </label>
      ) : null}

      {node.type === 'download-json' ? (
        <>
          <label className={styles.inspectorField}>
            <span>Filename</span>
            <input
              aria-label="Automation download filename"
              disabled={!generatedCodeInSync}
              value={node.filename}
              onChange={(event) => {
                const filename = event.currentTarget.value.trim();

                if (filename) {
                  onFilenameChange(filename);
                }
              }}
            />
          </label>
          <label className={styles.inspectorField}>
            <span>Value from</span>
            <input
              aria-label="Automation download value"
              disabled={!generatedCodeInSync}
              placeholder="All values"
              value={node.valueFrom ?? ''}
              onChange={(event) =>
                onValueFromChange(event.currentTarget.value.trim() || null)
              }
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

function selectorTestSummary(result: BlueprintSelectorTestResult): string {
  const summary = `${plural(result.matchCount, 'match')}, ${
    result.visibleCount
  } visible`;

  return result.firstTagName ? `${result.firstTagName}: ${summary}` : summary;
}

function plural(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 'es'}`;
}

function isAutomationNode(
  node: BlueprintNode,
): node is BlueprintAutomationNode {
  return isBlueprintAutomationAction(node.type);
}

function safetyLabel(
  level: ReturnType<typeof highestBlueprintSafetyLevel>,
): string {
  switch (level) {
    case 'danger':
      return 'Review';
    case 'warning':
      return 'Caution';
    case 'info':
      return 'Note';
    case undefined:
      return 'Normal';
  }
}

function safetyClass(
  level: ReturnType<typeof highestBlueprintSafetyLevel>,
): string {
  switch (level) {
    case 'danger':
      return styles.safetyDanger ?? '';
    case 'warning':
      return styles.safetyWarning ?? '';
    case 'info':
      return styles.safetyInfo ?? '';
    case undefined:
      return styles.safetySafe ?? '';
  }
}

function clampAutomationTimeout(value: number): number {
  return Math.min(60_000, Math.max(250, Math.round(value)));
}

function actionLabel(type: BlueprintNode['type']): string {
  return blueprintNodeLabel(type);
}

function qualityLabel(
  quality: ReturnType<typeof assessBlueprintSelector>['quality'],
) {
  switch (quality) {
    case 'strong':
      return 'Strong';
    case 'good':
      return 'Good';
    case 'fragile':
      return 'Fragile';
  }
}
