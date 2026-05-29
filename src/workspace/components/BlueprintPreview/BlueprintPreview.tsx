import { useMemo, useState, type CSSProperties } from 'react';

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
import type {
  BlueprintAutomationNodeRunInput,
  BlueprintAutomationNodeRunResult,
  BlueprintAutomationNodeTestInput,
  BlueprintAutomationNodeTestResult,
  BlueprintSelectorSuggestion,
  BlueprintSelectorTestResult,
} from '../../../shared/blueprint-messages';

import styles from './BlueprintPreview.module.scss';

const FLOW_NODE_HEIGHT = 156;
const FLOW_NODE_WIDTH = 260;
const FLOW_PADDING = 16;
const FLOW_START_GAP = 34;
const FLOW_START_WIDTH = 72;

type BlueprintPreviewProps = {
  blueprint: BlueprintRecipe | undefined;
  css?: string;
  js?: string;
  onPickSelector?:
    | (() => Promise<BlueprintElementPick | undefined>)
    | undefined;
  onRunAutomationNode?:
    | ((
        node: BlueprintAutomationNodeRunInput,
      ) => Promise<BlueprintAutomationNodeRunResult | undefined>)
    | undefined;
  onTestAutomationNode?:
    | ((
        node: BlueprintAutomationNodeTestInput,
      ) => Promise<BlueprintAutomationNodeTestResult | undefined>)
    | undefined;
  onTestSelector?:
    | ((selector: string) => Promise<BlueprintSelectorTestResult | undefined>)
    | undefined;
  onChange?(blueprint: BlueprintRecipe, css: string, js?: string): void;
};

type BlueprintFlowTestStep = {
  details: string[];
  id: string;
  label: string;
  preview?: string;
  ready: boolean;
  status: 'ready' | 'review' | 'skipped';
  summary: string;
};

export function BlueprintPreview({
  blueprint,
  css,
  js,
  onPickSelector,
  onRunAutomationNode,
  onTestAutomationNode,
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
  const [testingAutomationNodeId, setTestingAutomationNodeId] =
    useState<string>();
  const [runningAutomationNodeId, setRunningAutomationNodeId] =
    useState<string>();
  const [selectorTestResults, setSelectorTestResults] = useState<
    Record<string, BlueprintSelectorTestResult>
  >({});
  const [automationTestResults, setAutomationTestResults] = useState<
    Record<string, BlueprintAutomationNodeTestResult>
  >({});
  const [automationRunResults, setAutomationRunResults] = useState<
    Record<string, BlueprintAutomationNodeRunResult>
  >({});
  const [automationRunConfirmations, setAutomationRunConfirmations] = useState<
    Record<string, boolean>
  >({});
  const [flowTestResults, setFlowTestResults] = useState<
    BlueprintFlowTestStep[] | undefined
  >();
  const [testingFlow, setTestingFlow] = useState(false);

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

    if (options.regeneratesCode) {
      clearAutomationTestResult(nodeId);
      clearAutomationRunResult(nodeId);
      clearAutomationRunConfirmation(nodeId);
    }
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
      clearAutomationTestResult(nodeId);
      clearAutomationRunResult(nodeId);
      clearAutomationRunConfirmation(nodeId);
    } finally {
      setPickingNodeId(undefined);
    }
  }

  function applySelectorSuggestion(
    nodeId: string,
    suggestion: BlueprintSelectorSuggestion,
  ): void {
    if (!onChange || css === undefined || !generatedCodeInSync) {
      return;
    }

    const nextBlueprint = updateBlueprintNode(recipe, nodeId, {
      selector: suggestion.selector,
      selectorMeta: suggestion.selectorMeta,
    });

    emitGeneratedChange(nextBlueprint);
    clearSelectorTestResult(nodeId);
    clearAutomationTestResult(nodeId);
    clearAutomationRunResult(nodeId);
    clearAutomationRunConfirmation(nodeId);
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

  async function testAutomationNode(
    node: BlueprintAutomationNode,
  ): Promise<void> {
    if (!onTestAutomationNode) {
      return;
    }

    setTestingAutomationNodeId(node.id);

    try {
      const result = await onTestAutomationNode(automationNodeTestInput(node));

      if (!result) {
        return;
      }

      setAutomationTestResults((currentResults) => ({
        ...currentResults,
        [node.id]: result,
      }));
    } finally {
      setTestingAutomationNodeId(undefined);
    }
  }

  async function runAutomationNode(
    node: BlueprintAutomationNode,
  ): Promise<void> {
    if (!onRunAutomationNode || !canRunAutomationNode(node)) {
      return;
    }

    if (requiresRunConfirmation(node) && !automationRunConfirmations[node.id]) {
      return;
    }

    setRunningAutomationNodeId(node.id);

    try {
      const result = await onRunAutomationNode(
        automationNodeRunInput(
          node,
          Boolean(automationRunConfirmations[node.id]),
        ),
      );

      if (!result) {
        return;
      }

      setAutomationRunResults((currentResults) => ({
        ...currentResults,
        [node.id]: result,
      }));
    } finally {
      setRunningAutomationNodeId(undefined);
    }
  }

  async function testFlow(): Promise<void> {
    if (!onTestSelector && !onTestAutomationNode) {
      return;
    }

    setTestingFlow(true);
    setFlowTestResults([]);

    const results: BlueprintFlowTestStep[] = [];

    try {
      for (const node of nodes) {
        const result = await testFlowNode(node);

        results.push(result);
        setFlowTestResults([...results]);
      }
    } finally {
      setTestingFlow(false);
    }
  }

  async function testFlowNode(
    node: BlueprintNode,
  ): Promise<BlueprintFlowTestStep> {
    const label = node.label ?? actionLabel(node.type);

    if (!node.enabled) {
      return {
        details: ['Disabled nodes are skipped by generated Blueprint code.'],
        id: node.id,
        label,
        ready: true,
        status: 'skipped',
        summary: 'Skipped',
      };
    }

    if (isAutomationNode(node)) {
      if (!onTestAutomationNode) {
        return {
          details: ['Automation testing is unavailable for this workspace.'],
          id: node.id,
          label,
          ready: false,
          status: 'skipped',
          summary: 'Not tested',
        };
      }

      const result = await onTestAutomationNode(automationNodeTestInput(node));

      if (!result) {
        return {
          details: [
            'The source page did not return an automation test result.',
          ],
          id: node.id,
          label,
          ready: false,
          status: 'review',
          summary: 'No result',
        };
      }

      return {
        details: result.issues,
        id: node.id,
        label,
        ...(result.preview ? { preview: result.preview } : {}),
        ready: result.ready,
        status: result.ready ? 'ready' : 'review',
        summary: `${actionLabel(result.action)}: ${selectorTestSummary(
          result,
        )}`,
      };
    }

    if (!onTestSelector) {
      return {
        details: ['Selector testing is unavailable for this workspace.'],
        id: node.id,
        label,
        ready: false,
        status: 'skipped',
        summary: 'Not tested',
      };
    }

    const result = await onTestSelector(node.selector);

    if (!result) {
      return {
        details: ['The source page did not return a selector test result.'],
        id: node.id,
        label,
        ready: false,
        status: 'review',
        summary: 'No result',
      };
    }

    const details = selectorFlowTestDetails(result);

    return {
      details,
      id: node.id,
      label,
      ready: details.length === 0,
      status: details.length === 0 ? 'ready' : 'review',
      summary: `${actionLabel(node.type)}: ${selectorTestSummary(result)}`,
    };
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
    clearAutomationTestResult(nodeId);
    clearAutomationRunResult(nodeId);
    clearAutomationRunConfirmation(nodeId);
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

  function clearAutomationTestResult(nodeId: string): void {
    setAutomationTestResults((currentResults) => {
      const nextResults = { ...currentResults };

      delete nextResults[nodeId];

      return nextResults;
    });
  }

  function clearAutomationRunResult(nodeId: string): void {
    setAutomationRunResults((currentResults) => {
      const nextResults = { ...currentResults };

      delete nextResults[nodeId];

      return nextResults;
    });
  }

  function clearAutomationRunConfirmation(nodeId: string): void {
    setAutomationRunConfirmations((currentConfirmations) => {
      const nextConfirmations = { ...currentConfirmations };

      delete nextConfirmations[nodeId];

      return nextConfirmations;
    });
  }

  function updateAutomationRunConfirmation(
    nodeId: string,
    confirmed: boolean,
  ): void {
    setAutomationRunConfirmations((currentConfirmations) => ({
      ...currentConfirmations,
      [nodeId]: confirmed,
    }));
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

      <BlueprintFlowTestPanel
        generatedCodeInSync={generatedCodeInSync}
        results={flowTestResults}
        testing={testingFlow}
        onTest={
          onTestSelector || onTestAutomationNode
            ? () => void testFlow()
            : undefined
        }
      />

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

        <BlueprintFlowCanvas
          editable={editable}
          nodes={nodes}
          recipe={recipe}
          selectedNodeId={selectedNode?.id}
          onSelectNode={setSelectedNodeId}
        />

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
            onCodeChange={(code) =>
              editNode(selectedNode.id, { code }, { regeneratesCode: true })
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
            onApplySelectorSuggestion={(suggestion) =>
              applySelectorSuggestion(selectedNode.id, suggestion)
            }
            onRunAutomationNode={
              onRunAutomationNode &&
              isAutomationNode(selectedNode) &&
              canRunAutomationNode(selectedNode)
                ? () => void runAutomationNode(selectedNode)
                : undefined
            }
            onTestSelector={
              onTestSelector ? () => void testSelector(selectedNode) : undefined
            }
            onTestAutomationNode={
              onTestAutomationNode && isAutomationNode(selectedNode)
                ? () => void testAutomationNode(selectedNode)
                : undefined
            }
            automationRunResult={automationRunResults[selectedNode.id]}
            automationRunConfirmed={Boolean(
              automationRunConfirmations[selectedNode.id],
            )}
            automationTestResult={automationTestResults[selectedNode.id]}
            pickingSelector={pickingNodeId === selectedNode.id}
            runningAutomationNode={runningAutomationNodeId === selectedNode.id}
            runRequiresConfirmation={
              isAutomationNode(selectedNode) &&
              requiresRunConfirmation(selectedNode)
            }
            selectorTestResult={selectorTestResults[selectedNode.id]}
            testingAutomationNode={testingAutomationNodeId === selectedNode.id}
            testingSelector={testingNodeId === selectedNode.id}
            onRunConfirmationChange={(confirmed) =>
              updateAutomationRunConfirmation(selectedNode.id, confirmed)
            }
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

type BlueprintFlowTestPanelProps = {
  generatedCodeInSync: boolean;
  results: BlueprintFlowTestStep[] | undefined;
  testing: boolean;
  onTest?: (() => void) | undefined;
};

function BlueprintFlowTestPanel({
  generatedCodeInSync,
  results,
  testing,
  onTest,
}: BlueprintFlowTestPanelProps) {
  if (!onTest) {
    return null;
  }

  const readyCount =
    results?.filter((result) => result.status === 'ready').length ?? 0;
  const reviewCount = results?.filter((result) => !result.ready).length ?? 0;
  const skippedCount =
    results?.filter((result) => result.status === 'skipped').length ?? 0;

  return (
    <div className={styles.flowTestPanel}>
      <div>
        <strong>Flow preview</strong>
        <p>
          Checks every step on the source page without clicking, typing, or
          downloading.
        </p>
      </div>
      <button
        className={styles.testAutomation}
        disabled={!generatedCodeInSync || testing}
        type="button"
        onClick={onTest}
      >
        {testing ? 'Testing flow...' : 'Test flow'}
      </button>
      {results ? (
        <div className={styles.flowTestResults} aria-live="polite">
          <span>
            {readyCount} ready, {reviewCount} need review
            {skippedCount > 0 ? `, ${skippedCount} skipped` : ''}
          </span>
          <ol>
            {results.map((result) => (
              <li
                className={`${styles.flowTestStep} ${
                  result.status === 'ready'
                    ? styles.testReady
                    : result.status === 'skipped'
                      ? styles.testSkipped
                      : styles.testReview
                }`}
                key={result.id}
              >
                <strong>{result.label}</strong>
                <span>{result.summary}</span>
                {result.preview ? <p>{result.preview}</p> : null}
                {result.details.length > 0 ? (
                  <ul>
                    {result.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

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

type BlueprintFlowCanvasProps = {
  editable: boolean;
  nodes: BlueprintNode[];
  recipe: BlueprintRecipe;
  selectedNodeId?: string | undefined;
  onSelectNode(nodeId: string): void;
};

function BlueprintFlowCanvas({
  editable,
  nodes,
  recipe,
  selectedNodeId,
  onSelectNode,
}: BlueprintFlowCanvasProps) {
  const layoutPoints = nodes.map(
    (node, index) => recipe.graph.layout[node.id] ?? { x: index * 220, y: 0 },
  );
  const minX = Math.min(0, ...layoutPoints.map((point) => point.x));
  const minY = Math.min(0, ...layoutPoints.map((point) => point.y));
  const positionedNodes = nodes.map((node, index) => {
    const point = layoutPoints[index] ?? { x: index * 220, y: 0 };

    return {
      node,
      x: point.x - minX + FLOW_PADDING + FLOW_START_WIDTH + FLOW_START_GAP,
      y: point.y - minY + FLOW_PADDING,
    };
  });
  const firstNode = positionedNodes[0];
  const canvasWidth =
    Math.max(
      FLOW_PADDING + FLOW_START_WIDTH,
      ...positionedNodes.map((position) => position.x + FLOW_NODE_WIDTH),
    ) + FLOW_PADDING;
  const canvasHeight =
    Math.max(
      FLOW_NODE_HEIGHT,
      ...positionedNodes.map((position) => position.y + FLOW_NODE_HEIGHT),
    ) + FLOW_PADDING;
  const startTop = firstNode
    ? firstNode.y + FLOW_NODE_HEIGHT / 2 - 14
    : FLOW_PADDING;
  const startCenterY = startTop + 14;
  const firstNodeCenterY = firstNode
    ? firstNode.y + FLOW_NODE_HEIGHT / 2
    : startCenterY;

  return (
    <div
      className={styles.flowCanvas}
      role="group"
      aria-label="Blueprint flow diagram"
    >
      <div
        className={styles.flowViewport}
        style={
          {
            minHeight: `${canvasHeight}px`,
            minWidth: `${canvasWidth}px`,
          } satisfies CSSProperties
        }
      >
        <svg
          aria-hidden="true"
          className={styles.flowEdges}
          height={canvasHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          width={canvasWidth}
        >
          <defs>
            <marker
              id="tampr-blueprint-flow-arrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          {firstNode ? (
            <path
              d={`M ${FLOW_PADDING + FLOW_START_WIDTH} ${startCenterY} C ${
                FLOW_PADDING + FLOW_START_WIDTH + 20
              } ${startCenterY}, ${firstNode.x - 20} ${firstNodeCenterY}, ${
                firstNode.x
              } ${firstNodeCenterY}`}
              markerEnd="url(#tampr-blueprint-flow-arrow)"
            />
          ) : null}
          {positionedNodes.slice(0, -1).map((position, index) => {
            const nextPosition = positionedNodes[index + 1];

            if (!nextPosition) {
              return null;
            }

            const fromX = position.x + FLOW_NODE_WIDTH;
            const fromY = position.y + FLOW_NODE_HEIGHT / 2;
            const toX = nextPosition.x;
            const toY = nextPosition.y + FLOW_NODE_HEIGHT / 2;

            return (
              <path
                d={`M ${fromX} ${fromY} C ${fromX + 34} ${fromY}, ${
                  toX - 34
                } ${toY}, ${toX} ${toY}`}
                key={`${position.node.id}-${nextPosition.node.id}`}
                markerEnd="url(#tampr-blueprint-flow-arrow)"
              />
            );
          })}
        </svg>
        <span
          className={styles.flowStart}
          style={
            {
              left: `${FLOW_PADDING}px`,
              top: `${startTop}px`,
              width: `${FLOW_START_WIDTH}px`,
            } satisfies CSSProperties
          }
        >
          Start
        </span>
        <ol className={styles.flow} aria-label="Blueprint flow nodes">
          {positionedNodes.map((position, index) => (
            <BlueprintPreviewNode
              editable={editable}
              index={index}
              key={position.node.id}
              node={position.node}
              selected={position.node.id === selectedNodeId}
              style={
                {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: `${FLOW_NODE_WIDTH}px`,
                } satisfies CSSProperties
              }
              onSelect={() => onSelectNode(position.node.id)}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

type BlueprintPreviewNodeProps = {
  editable: boolean;
  index: number;
  node: BlueprintNode;
  selected: boolean;
  style: CSSProperties;
  onSelect(): void;
};

function BlueprintPreviewNode({
  editable,
  index,
  node,
  selected,
  style,
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
        <p>{selectorConfidenceSummary(assessment)}</p>
      </div>
      <span className={`${styles.quality} ${styles[assessment.quality]}`}>
        {qualityLabel(assessment.quality)}
      </span>
    </>
  );

  return (
    <li className={styles.node} style={style}>
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
  automationRunConfirmed: boolean;
  automationRunResult?: BlueprintAutomationNodeRunResult | undefined;
  automationTestResult?: BlueprintAutomationNodeTestResult | undefined;
  generatedCodeInSync: boolean;
  node: BlueprintNode;
  onEnabledChange(enabled: boolean): void;
  onCodeChange(code: string): void;
  onFilenameChange(filename: string): void;
  onLabelChange(label: string): void;
  onMoveDown(): void;
  onMoveUp(): void;
  onApplySelectorSuggestion(suggestion: BlueprintSelectorSuggestion): void;
  onPickSelector?: (() => void) | undefined;
  onRequireVisibleChange(requireVisible: boolean): void;
  onRemove(): void;
  onRunAutomationNode?: (() => void) | undefined;
  onRunConfirmationChange(confirmed: boolean): void;
  onTestSelector?: (() => void) | undefined;
  onTestAutomationNode?: (() => void) | undefined;
  onTimeoutChange(timeoutMs: number): void;
  onTypeChange(type: BlueprintCssAction): void;
  onValueChange(value: string): void;
  onValueFromChange(valueFrom: string | null): void;
  onVariableNameChange(variableName: string): void;
  pickingSelector: boolean;
  runningAutomationNode: boolean;
  runRequiresConfirmation: boolean;
  selectorTestResult?: BlueprintSelectorTestResult | undefined;
  testingAutomationNode: boolean;
  testingSelector: boolean;
};

function BlueprintNodeInspector({
  canMoveDown,
  canMoveUp,
  canRemove,
  automationRunConfirmed,
  automationRunResult,
  automationTestResult,
  generatedCodeInSync,
  node,
  onEnabledChange,
  onCodeChange,
  onFilenameChange,
  onLabelChange,
  onMoveDown,
  onMoveUp,
  onApplySelectorSuggestion,
  onPickSelector,
  onRequireVisibleChange,
  onRemove,
  onRunAutomationNode,
  onRunConfirmationChange,
  onTestSelector,
  onTestAutomationNode,
  onTimeoutChange,
  onTypeChange,
  onValueChange,
  onValueFromChange,
  onVariableNameChange,
  pickingSelector,
  runningAutomationNode,
  runRequiresConfirmation,
  selectorTestResult,
  testingAutomationNode,
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
          <BlueprintAutomationTestPanel
            generatedCodeInSync={generatedCodeInSync}
            result={automationTestResult}
            testing={testingAutomationNode}
            onTest={onTestAutomationNode}
          />
          <BlueprintAutomationRunPanel
            confirmed={automationRunConfirmed}
            generatedCodeInSync={generatedCodeInSync}
            result={automationRunResult}
            running={runningAutomationNode}
            requiresConfirmation={runRequiresConfirmation}
            onRun={onRunAutomationNode}
            onConfirmChange={onRunConfirmationChange}
          />
          <BlueprintAutomationSettings
            generatedCodeInSync={generatedCodeInSync}
            node={node}
            onCodeChange={onCodeChange}
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
        {selectorTestResult?.recommendation ? (
          <p className={styles.selectorRecommendation}>
            {selectorTestResult.recommendation}
          </p>
        ) : null}
        {selectorTestResult?.suggestions?.length ? (
          <div
            className={styles.selectorSuggestions}
            aria-label="Selector repair suggestions"
          >
            <strong>Repair suggestions</strong>
            {selectorTestResult.suggestions.map((suggestion) => (
              <div
                className={styles.selectorSuggestion}
                key={suggestion.selector}
              >
                <code>{suggestion.selector}</code>
                <p>{suggestion.reason}</p>
                <button
                  disabled={!generatedCodeInSync}
                  type="button"
                  onClick={() => onApplySelectorSuggestion(suggestion)}
                >
                  Use selector
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.selectorField}>
        <span>Health</span>
        <strong className={`${styles.health} ${styles[assessment.quality]}`}>
          {qualityLabel(assessment.quality)}
        </strong>
        <p>{selectorConfidenceSummary(assessment)}</p>
        <p>{assessment.recommendation}</p>
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

type BlueprintAutomationTestPanelProps = {
  generatedCodeInSync: boolean;
  result?: BlueprintAutomationNodeTestResult | undefined;
  testing: boolean;
  onTest?: (() => void) | undefined;
};

function BlueprintAutomationTestPanel({
  generatedCodeInSync,
  result,
  testing,
  onTest,
}: BlueprintAutomationTestPanelProps) {
  if (!onTest) {
    return null;
  }

  return (
    <div className={styles.automationTestPanel}>
      <button
        className={styles.testAutomation}
        disabled={!generatedCodeInSync || testing}
        type="button"
        onClick={onTest}
      >
        {testing ? 'Testing...' : 'Test node'}
      </button>
      {result ? (
        <div
          className={`${styles.automationTestResult} ${
            result.ready ? styles.testReady : styles.testReview
          }`}
          aria-live="polite"
        >
          <strong>{result.ready ? 'Ready on page' : 'Needs review'}</strong>
          <span>
            {result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'},{' '}
            {result.visibleCount} visible
          </span>
          {result.preview ? <p>{result.preview}</p> : null}
          {result.issues.length > 0 ? (
            <ul>
              {result.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type BlueprintAutomationRunPanelProps = {
  confirmed: boolean;
  generatedCodeInSync: boolean;
  result?: BlueprintAutomationNodeRunResult | undefined;
  requiresConfirmation: boolean;
  running: boolean;
  onConfirmChange(confirmed: boolean): void;
  onRun?: (() => void) | undefined;
};

function BlueprintAutomationRunPanel({
  confirmed,
  generatedCodeInSync,
  result,
  requiresConfirmation,
  running,
  onConfirmChange,
  onRun,
}: BlueprintAutomationRunPanelProps) {
  if (!onRun) {
    return null;
  }

  return (
    <div className={styles.automationTestPanel}>
      {requiresConfirmation ? (
        <label className={styles.runConfirmation}>
          <input
            checked={confirmed}
            type="checkbox"
            onChange={(event) => onConfirmChange(event.currentTarget.checked)}
          />
          <span>Confirm click on source page</span>
        </label>
      ) : null}
      <button
        className={styles.runAutomation}
        disabled={
          !generatedCodeInSync ||
          running ||
          (requiresConfirmation && !confirmed)
        }
        type="button"
        onClick={onRun}
      >
        {running ? 'Running...' : 'Run node'}
      </button>
      {result ? (
        <div
          className={`${styles.automationTestResult} ${styles.testReady}`}
          aria-live="polite"
        >
          <strong>Ran on page</strong>
          <span>
            {result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'},{' '}
            {result.visibleCount} visible
          </span>
          <span>{result.message}</span>
          {result.value ? <p>{result.value}</p> : null}
          {!result.value && result.preview ? <p>{result.preview}</p> : null}
        </div>
      ) : null}
    </div>
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
  onCodeChange(code: string): void;
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
  onCodeChange,
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

      {node.type === 'custom-code' ? (
        <label className={styles.inspectorField}>
          <span>Code</span>
          <textarea
            aria-label="Automation custom code"
            disabled={!generatedCodeInSync}
            rows={6}
            value={node.code}
            onChange={(event) => onCodeChange(event.currentTarget.value)}
          />
        </label>
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

function selectorFlowTestDetails(
  result: BlueprintSelectorTestResult,
): string[] {
  const details: string[] = [];

  if (result.matchCount === 0) {
    details.push('Selector does not match anything on the source page.');
    return details;
  }

  if (result.matchCount > 1) {
    details.push(
      `Selector matches ${result.matchCount} elements on the source page.`,
    );
  }

  if (result.visibleCount === 0) {
    details.push('No matching elements are visible.');
  }

  return details;
}

function selectorConfidenceSummary(
  assessment: ReturnType<typeof assessBlueprintSelector>,
): string {
  return `${assessment.score}% confidence. ${assessment.detail}`;
}

function plural(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 'es'}`;
}

function isAutomationNode(
  node: BlueprintNode,
): node is BlueprintAutomationNode {
  return isBlueprintAutomationAction(node.type);
}

function automationNodeTestInput(
  node: BlueprintAutomationNode,
): BlueprintAutomationNodeTestInput {
  return {
    selector: node.selector,
    type: node.type,
    ...('filename' in node ? { filename: node.filename } : {}),
    ...('code' in node ? { code: node.code } : {}),
    ...('requireVisible' in node
      ? { requireVisible: node.requireVisible }
      : {}),
    ...('value' in node ? { value: node.value } : {}),
    ...('valueFrom' in node && node.valueFrom
      ? { valueFrom: node.valueFrom }
      : {}),
    ...('variableName' in node ? { variableName: node.variableName } : {}),
  };
}

function automationNodeRunInput(
  node: BlueprintAutomationNode,
  confirmed: boolean,
): BlueprintAutomationNodeRunInput {
  return {
    ...automationNodeTestInput(node),
    ...(confirmed ? { confirmAction: true } : {}),
    ...('timeoutMs' in node ? { timeoutMs: node.timeoutMs } : {}),
    ...(node.label ? { label: node.label } : {}),
  };
}

function canRunAutomationNode(node: BlueprintAutomationNode): boolean {
  return (
    node.type === 'wait-for-element' ||
    node.type === 'extract-text' ||
    node.type === 'click'
  );
}

function requiresRunConfirmation(node: BlueprintAutomationNode): boolean {
  return node.type === 'click';
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
