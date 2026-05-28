import { useMemo, useState } from 'react';

import { assessBlueprintSelector } from '../../../domain/blueprint-selectors';
import type { BlueprintElementPick } from '../../../domain/blueprint-snippets';
import {
  BLUEPRINT_CSS_ACTIONS,
  blueprintActionDescription,
  blueprintActionLabel,
  type BlueprintCssAction,
} from '../../../domain/blueprints/actions';
import {
  compileBlueprintCss,
  isBlueprintCssInSync,
} from '../../../domain/blueprints/compiler';
import {
  getLinearBlueprintNodes,
  insertBlueprintNode,
  moveBlueprintNode,
  removeBlueprintNode,
  updateBlueprintNode,
  type MoveBlueprintNodeDirection,
  type BlueprintNode,
  type BlueprintRecipe,
} from '../../../domain/blueprints/recipe';
import type { BlueprintSelectorTestResult } from '../../../shared/blueprint-messages';

import styles from './BlueprintPreview.module.scss';

type BlueprintPreviewProps = {
  blueprint: BlueprintRecipe | undefined;
  css?: string;
  onPickSelector?:
    | (() => Promise<BlueprintElementPick | undefined>)
    | undefined;
  onTestSelector?:
    | ((selector: string) => Promise<BlueprintSelectorTestResult | undefined>)
    | undefined;
  onChange?(blueprint: BlueprintRecipe, css: string): void;
};

export function BlueprintPreview({
  blueprint,
  css,
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
  const cssInSync = cssSourceKnown ? isBlueprintCssInSync(recipe, css) : true;
  const editable = Boolean(onChange && cssSourceKnown && selectedNode);

  function editNode(
    nodeId: string,
    update: Parameters<typeof updateBlueprintNode>[2],
    options: { regeneratesCss: boolean },
  ): void {
    if (!onChange || css === undefined) {
      return;
    }

    if (options.regeneratesCss && !cssInSync) {
      return;
    }

    const nextBlueprint = updateBlueprintNode(recipe, nodeId, update);
    const nextCss = options.regeneratesCss
      ? compileBlueprintCss(nextBlueprint)
      : css;

    onChange(nextBlueprint, nextCss);
  }

  async function pickSelector(nodeId: string): Promise<void> {
    if (!onChange || !onPickSelector || css === undefined || !cssInSync) {
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

      onChange(nextBlueprint, compileBlueprintCss(nextBlueprint));
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
    if (!onChange || css === undefined || !cssInSync) {
      return;
    }

    if (nextSelectedNodeId) {
      setSelectedNodeId(nextSelectedNodeId);
    }

    onChange(nextBlueprint, compileBlueprintCss(nextBlueprint));
  }

  function addNode(type: BlueprintCssAction): void {
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
              cssInSync ? styles.synced : styles.changed
            }`}
          >
            {cssInSync ? 'Synced' : 'Code edited'}
          </span>
        ) : null}
      </header>

      <div
        className={`${styles.builder} ${
          editable ? styles.editableBuilder : styles.readOnlyBuilder
        }`}
      >
        {editable ? (
          <BlueprintNodeLibrary cssInSync={cssInSync} onAdd={addNode} />
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
            cssInSync={cssInSync}
            node={selectedNode}
            canRemove={nodes.length > 1}
            onEnabledChange={(enabled) =>
              editNode(selectedNode.id, { enabled }, { regeneratesCss: true })
            }
            onLabelChange={(label) =>
              editNode(selectedNode.id, { label }, { regeneratesCss: false })
            }
            onMoveDown={() => moveNode(selectedNode.id, 'down')}
            onMoveUp={() => moveNode(selectedNode.id, 'up')}
            onTypeChange={(type) =>
              editNode(selectedNode.id, { type }, { regeneratesCss: true })
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
  cssInSync: boolean;
  onAdd(type: BlueprintCssAction): void;
};

function BlueprintNodeLibrary({ cssInSync, onAdd }: BlueprintNodeLibraryProps) {
  return (
    <aside className={styles.library} aria-label="Blueprint node library">
      <header>
        <span>Library</span>
        <strong>CSS actions</strong>
      </header>

      <div className={styles.libraryActions}>
        {BLUEPRINT_CSS_ACTIONS.map((action) => (
          <button
            aria-label={`Add ${blueprintActionLabel(action)} node`}
            disabled={!cssInSync}
            key={action}
            title={blueprintActionDescription(action)}
            type="button"
            onClick={() => onAdd(action)}
          >
            {blueprintActionLabel(action)}
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
  cssInSync: boolean;
  node: BlueprintNode;
  onEnabledChange(enabled: boolean): void;
  onLabelChange(label: string): void;
  onMoveDown(): void;
  onMoveUp(): void;
  onPickSelector?: (() => void) | undefined;
  onRemove(): void;
  onTestSelector?: (() => void) | undefined;
  onTypeChange(type: BlueprintCssAction): void;
  pickingSelector: boolean;
  selectorTestResult?: BlueprintSelectorTestResult | undefined;
  testingSelector: boolean;
};

function BlueprintNodeInspector({
  canMoveDown,
  canMoveUp,
  canRemove,
  cssInSync,
  node,
  onEnabledChange,
  onLabelChange,
  onMoveDown,
  onMoveUp,
  onPickSelector,
  onRemove,
  onTestSelector,
  onTypeChange,
  pickingSelector,
  selectorTestResult,
  testingSelector,
}: BlueprintNodeInspectorProps) {
  const assessment = assessBlueprintSelector(node.selectorMeta);
  const label = node.label ?? actionLabel(node.type);

  return (
    <aside className={styles.inspector} aria-label="Blueprint node inspector">
      <header>
        <span>Inspector</span>
        <strong>{label}</strong>
      </header>

      <div className={styles.selectorField}>
        <span>Action</span>
        <select
          aria-label="Blueprint node action"
          disabled={!cssInSync}
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
        <p>{blueprintActionDescription(node.type)}</p>
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
          disabled={!cssInSync}
          type="checkbox"
          onChange={(event) => onEnabledChange(event.currentTarget.checked)}
        />
        <span>Enabled</span>
      </label>

      <div className={styles.selectorField}>
        <span>Flow position</span>
        <div className={styles.selectorActions}>
          <button
            className={styles.moveNode}
            disabled={!cssInSync || !canMoveUp}
            type="button"
            onClick={onMoveUp}
          >
            Move up
          </button>
          <button
            className={styles.moveNode}
            disabled={!cssInSync || !canMoveDown}
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
              disabled={!cssInSync || pickingSelector || testingSelector}
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
        disabled={!cssInSync || !canRemove}
        type="button"
        onClick={onRemove}
      >
        Remove node
      </button>
    </aside>
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

function actionLabel(type: BlueprintNode['type']): string {
  return blueprintActionLabel(type);
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
