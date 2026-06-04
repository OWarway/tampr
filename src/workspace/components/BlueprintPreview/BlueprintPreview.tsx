import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { assessBlueprintSelector } from '../../../domain/blueprint-selectors';
import type { BlueprintElementPick } from '../../../domain/blueprint-snippets';
import {
  BLUEPRINT_CSS_ACTIONS,
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
  updateBlueprintNodeLayout,
  type MoveBlueprintNodeDirection,
  type BlueprintAutomationNode,
  type BlueprintLayoutPoint,
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
const FLOW_DRAG_THRESHOLD = 4;
const FLOW_NODE_NUDGE = 24;
const FLOW_NODE_FAST_NUDGE = 80;

type BlueprintPreviewProps = {
  blueprint: BlueprintRecipe | undefined;
  css?: string;
  js?: string;
  onDownloadJson?:
    | ((
        input: BlueprintJsonDownloadInput,
      ) => Promise<BlueprintJsonDownloadResult>)
    | undefined;
  onPickSelector?:
    | (() => Promise<BlueprintElementPick | undefined>)
    | undefined;
  onRunAutomationNode?:
    | ((
        node: BlueprintAutomationNodeRunInput,
      ) => Promise<BlueprintAutomationNodeRunResult | undefined>)
    | undefined;
  onCancelAutomationRun?: ((runId: string) => Promise<boolean>) | undefined;
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

type BlueprintJsonDownloadInput = {
  filename: string;
  value: unknown;
};

type BlueprintJsonDownloadResult = {
  mode: 'anchor' | 'browser-api';
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

type BlueprintFlowRunStep = {
  details: string[];
  id: string;
  label: string;
  preview?: string;
  status:
    | 'blocked'
    | 'cancelled'
    | 'complete'
    | 'failed'
    | 'paused'
    | 'running'
    | 'skipped';
  summary: string;
};

type BlueprintFlowNodeStatus =
  | BlueprintFlowRunStep['status']
  | BlueprintFlowTestStep['status']
  | 'pending';

type BlueprintFlowRunContext = {
  values: Record<string, unknown>;
};

type BlueprintNodeDragState = {
  currentPoint: BlueprintLayoutPoint;
  moved: boolean;
  nodeId: string;
  originPoint: BlueprintLayoutPoint;
  pointerId: number;
  startClientX: number;
  startClientY: number;
};

export function BlueprintPreview({
  blueprint,
  css,
  js,
  onDownloadJson,
  onPickSelector,
  onRunAutomationNode,
  onCancelAutomationRun,
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
  const [flowRunResults, setFlowRunResults] = useState<
    BlueprintFlowRunStep[] | undefined
  >();
  const [runningFlow, setRunningFlow] = useState(false);
  const [activeFlowRunNodeIds, setActiveFlowRunNodeIds] = useState<string[]>();
  const [pausedFlowRun, setPausedFlowRun] = useState<
    { label: string; nodeId: string } | undefined
  >();
  const [flowRunConfirmed, setFlowRunConfirmed] = useState(false);
  const flowRunControlRef = useRef<
    | {
        cancelled: boolean;
        resumePausedRun?: ((continued: boolean) => void) | undefined;
        runId: string;
      }
    | undefined
  >(undefined);

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
  const nodesThroughSelectedNode = flowNodesUntil(nodes, selectedNode?.id);
  const flowRunRequiresConfirmation =
    flowRequiresRunConfirmationForNodes(nodes);
  const runToSelectedRequiresConfirmation = flowRequiresRunConfirmationForNodes(
    nodesThroughSelectedNode,
  );
  const flowNodeStatusByNodeId: Record<string, BlueprintFlowNodeStatus> = {
    ...Object.fromEntries(
      (flowTestResults ?? []).map((result) => [result.id, result.status]),
    ),
    ...Object.fromEntries(
      (flowRunResults ?? []).map((result) => [result.id, result.status]),
    ),
  };
  const pendingFlowNodeIds = testingFlow
    ? nodes.map((node) => node.id)
    : activeFlowRunNodeIds;

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
    if (!onRunAutomationNode || !canRunManualAutomationNode(node)) {
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
    setFlowRunResults(undefined);

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

  async function runFlow(untilNodeId?: string): Promise<void> {
    if (!onRunAutomationNode) {
      return;
    }

    const nodesToRun = flowNodesUntil(nodes, untilNodeId);
    const runRequiresConfirmation =
      flowRequiresRunConfirmationForNodes(nodesToRun);
    const runId = createBlueprintRunId();
    const control = {
      cancelled: false,
      runId,
    };

    if (runRequiresConfirmation && !flowRunConfirmed) {
      return;
    }

    flowRunControlRef.current = control;
    setRunningFlow(true);
    setActiveFlowRunNodeIds(nodesToRun.map((node) => node.id));
    setPausedFlowRun(undefined);
    setFlowTestResults(undefined);
    setFlowRunResults([]);

    const results: BlueprintFlowRunStep[] = [];
    const runContext: BlueprintFlowRunContext = { values: {} };

    try {
      for (const node of nodesToRun) {
        if (control.cancelled) {
          break;
        }

        results.push(runningFlowStep(node));
        setFlowRunResults([...results]);

        if (shouldPauseBeforeRun(node)) {
          results[results.length - 1] = pausedFlowStep(node);
          setPausedFlowRun({
            label: node.label ?? actionLabel(node.type),
            nodeId: node.id,
          });
          setFlowRunResults([...results]);

          const continued = await waitForPausedFlowRun(control);

          setPausedFlowRun(undefined);

          if (!continued || control.cancelled) {
            results[results.length - 1] = cancelledFlowStep(node);
            setFlowRunResults([...results]);
            break;
          }

          results[results.length - 1] = runningFlowStep(node);
          setFlowRunResults([...results]);
        }

        const result = await runFlowNode(
          node,
          runId,
          () => control.cancelled,
          runContext,
        );

        results[results.length - 1] = result;
        setFlowRunResults([...results]);

        if (
          result.status === 'blocked' ||
          result.status === 'cancelled' ||
          result.status === 'failed'
        ) {
          break;
        }
      }
    } finally {
      setRunningFlow(false);
      setActiveFlowRunNodeIds(undefined);
      setPausedFlowRun(undefined);
      flowRunControlRef.current = undefined;
    }
  }

  async function runFlowNode(
    node: BlueprintNode,
    runId: string,
    isFlowCancelled: () => boolean,
    runContext: BlueprintFlowRunContext,
  ): Promise<BlueprintFlowRunStep> {
    const label = node.label ?? actionLabel(node.type);

    if (!node.enabled) {
      return {
        details: ['Disabled nodes are skipped by generated Blueprint code.'],
        id: node.id,
        label,
        status: 'skipped',
        summary: 'Skipped',
      };
    }

    if (!isAutomationNode(node)) {
      return {
        details: [
          'CSS nodes are applied by generated CSS and are not manually executed.',
        ],
        id: node.id,
        label,
        status: 'skipped',
        summary: 'Skipped CSS',
      };
    }

    if (!canRunFlowAutomationNode(node)) {
      return {
        details: [
          `${actionLabel(
            node.type,
          )} is not available in guarded flow runs yet.`,
        ],
        id: node.id,
        label,
        status: 'blocked',
        summary: 'Blocked',
      };
    }

    if (requiresRunConfirmation(node) && !flowRunConfirmed) {
      return {
        details: [
          `${actionLabel(node.type)} steps need explicit confirmation before they run.`,
        ],
        id: node.id,
        label,
        status: 'blocked',
        summary: 'Confirmation needed',
      };
    }

    if (node.type === 'download-json') {
      return await runDownloadJsonNode(node, runContext);
    }

    if (!onRunAutomationNode) {
      return {
        details: ['Automation running is unavailable for this workspace.'],
        id: node.id,
        label,
        status: 'failed',
        summary: 'Runner unavailable',
      };
    }

    try {
      const result = await onRunAutomationNode(
        automationNodeRunInput(
          node,
          requiresRunConfirmation(node) && flowRunConfirmed,
          runId,
        ),
      );

      if (!result) {
        if (isFlowCancelled()) {
          return cancelledFlowStep(node);
        }

        return {
          details: ['The source page did not return an automation run result.'],
          id: node.id,
          label,
          status: 'failed',
          summary: 'No result',
        };
      }

      if (
        result.action === 'extract-text' ||
        result.action === 'extract-list'
      ) {
        if (result.variableName) {
          runContext.values[result.variableName] =
            result.action === 'extract-list'
              ? parseExtractedListValue(result.value)
              : (result.value ?? '');
        }
      }

      return {
        details: [
          result.message,
          ...(result.action === 'click'
            ? ['Blueprint clicks are synthetic: event.isTrusted === false.']
            : []),
        ],
        id: node.id,
        label,
        ...(result.value || result.preview
          ? { preview: result.value ?? result.preview }
          : {}),
        status: 'complete',
        summary: `${actionLabel(result.action)}: ${selectorTestSummary(
          result,
        )}`,
      };
    } catch (error) {
      return {
        details: [errorMessage(error)],
        id: node.id,
        label,
        status: 'failed',
        summary: 'Run failed',
      };
    }
  }

  async function runDownloadJsonNode(
    node: Extract<BlueprintAutomationNode, { type: 'download-json' }>,
    runContext: BlueprintFlowRunContext,
  ): Promise<BlueprintFlowRunStep> {
    const label = node.label ?? actionLabel(node.type);

    if (!onDownloadJson) {
      return {
        details: ['JSON downloading is unavailable for this workspace.'],
        id: node.id,
        label,
        status: 'failed',
        summary: 'Download unavailable',
      };
    }

    if (node.valueFrom && !(node.valueFrom in runContext.values)) {
      return {
        details: [
          `No flow value named "${node.valueFrom}" has been captured yet.`,
        ],
        id: node.id,
        label,
        status: 'failed',
        summary: 'Missing value',
      };
    }

    const value = node.valueFrom
      ? runContext.values[node.valueFrom]
      : runContext.values;

    try {
      const result = await onDownloadJson({
        filename: node.filename,
        value,
      });

      return {
        details: [
          result.mode === 'browser-api'
            ? 'JSON downloaded with browser downloads.'
            : 'JSON downloaded from the workspace.',
        ],
        id: node.id,
        label,
        preview: downloadPreview(value),
        status: 'complete',
        summary: 'Download JSON: file ready',
      };
    } catch (error) {
      return {
        details: [errorMessage(error)],
        id: node.id,
        label,
        status: 'failed',
        summary: 'Download failed',
      };
    }
  }

  function requestFlowRunStop(): void {
    const control = flowRunControlRef.current;

    if (!control) {
      return;
    }

    control.cancelled = true;
    control.resumePausedRun?.(false);
    setPausedFlowRun(undefined);

    if (onCancelAutomationRun) {
      void onCancelAutomationRun(control.runId);
    }
  }

  function continuePausedFlowRun(): void {
    flowRunControlRef.current?.resumePausedRun?.(true);
  }

  function waitForPausedFlowRun(control: {
    cancelled: boolean;
    resumePausedRun?: ((continued: boolean) => void) | undefined;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      control.resumePausedRun = (continued) => {
        control.resumePausedRun = undefined;
        resolve(continued);
      };
    });
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

  function moveNodeLayout(nodeId: string, point: BlueprintLayoutPoint): void {
    if (!onChange || css === undefined) {
      return;
    }

    setSelectedNodeId(nodeId);
    emitChange(updateBlueprintNodeLayout(recipe, nodeId, point), css, js);
  }

  function emitGeneratedChange(nextBlueprint: BlueprintRecipe): void {
    setFlowTestResults(undefined);
    setFlowRunResults(undefined);
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
        runConfirmed={flowRunConfirmed}
        runRequiresConfirmation={flowRunRequiresConfirmation}
        runToSelectedRequiresConfirmation={runToSelectedRequiresConfirmation}
        runResults={flowRunResults}
        running={runningFlow}
        pausedRun={pausedFlowRun}
        selectedNodeLabel={
          selectedNode
            ? (selectedNode.label ?? actionLabel(selectedNode.type))
            : undefined
        }
        results={flowTestResults}
        testing={testingFlow}
        onRun={onRunAutomationNode ? () => void runFlow() : undefined}
        onRunConfirmChange={setFlowRunConfirmed}
        onRunToSelected={
          onRunAutomationNode && selectedNode && nodes.length > 1
            ? () => void runFlow(selectedNode.id)
            : undefined
        }
        onTest={
          onTestSelector || onTestAutomationNode
            ? () => void testFlow()
            : undefined
        }
        onContinuePausedRun={continuePausedFlowRun}
        onStopRun={requestFlowRunStop}
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
          flowNodeStatusByNodeId={flowNodeStatusByNodeId}
          testingFlow={testingFlow}
          nodes={nodes}
          pendingNodeIds={pendingFlowNodeIds}
          recipe={recipe}
          selectedNodeId={selectedNode?.id}
          onMoveNodeLayout={moveNodeLayout}
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
              editNode(
                selectedNode.id,
                {
                  code,
                  ...(selectedNode.type === 'custom-code'
                    ? { reviewed: false }
                    : {}),
                },
                { regeneratesCode: true },
              )
            }
            onLabelChange={(label) =>
              editNode(selectedNode.id, { label }, { regeneratesCode: true })
            }
            onMaxItemsChange={(maxItems) =>
              editNode(selectedNode.id, { maxItems }, { regeneratesCode: true })
            }
            onMoveDown={() => moveNode(selectedNode.id, 'down')}
            onMoveUp={() => moveNode(selectedNode.id, 'up')}
            onPauseBeforeRunChange={(pauseBeforeRun) =>
              editNode(
                selectedNode.id,
                { pauseBeforeRun },
                { regeneratesCode: true },
              )
            }
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
            onReviewedChange={(reviewed) =>
              editNode(selectedNode.id, { reviewed }, { regeneratesCode: true })
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
              canRunManualAutomationNode(selectedNode)
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

const BLUEPRINT_NODE_LIBRARY_GROUPS: ReadonlyArray<{
  actions: readonly BlueprintNodeType[];
  label: string;
}> = [
  {
    label: 'Visual',
    actions: BLUEPRINT_CSS_ACTIONS,
  },
  {
    label: 'Actions',
    actions: ['wait-for-element', 'click', 'set-value'],
  },
  {
    label: 'Data',
    actions: ['extract-text', 'extract-list', 'download-json'],
  },
  {
    label: 'Advanced',
    actions: ['custom-code'],
  },
];

type BlueprintFlowTestPanelProps = {
  generatedCodeInSync: boolean;
  runConfirmed: boolean;
  runRequiresConfirmation: boolean;
  runToSelectedRequiresConfirmation: boolean;
  runResults: BlueprintFlowRunStep[] | undefined;
  running: boolean;
  pausedRun?: { label: string; nodeId: string } | undefined;
  selectedNodeLabel?: string | undefined;
  results: BlueprintFlowTestStep[] | undefined;
  testing: boolean;
  onRun?: (() => void) | undefined;
  onRunConfirmChange(confirmed: boolean): void;
  onRunToSelected?: (() => void) | undefined;
  onContinuePausedRun(): void;
  onStopRun(): void;
  onTest?: (() => void) | undefined;
};

function BlueprintFlowTestPanel({
  generatedCodeInSync,
  runConfirmed,
  runRequiresConfirmation,
  runToSelectedRequiresConfirmation,
  runResults,
  running,
  pausedRun,
  selectedNodeLabel,
  results,
  testing,
  onRun,
  onRunConfirmChange,
  onRunToSelected,
  onContinuePausedRun,
  onStopRun,
  onTest,
}: BlueprintFlowTestPanelProps) {
  if (!onTest && !onRun && !onRunToSelected) {
    return null;
  }

  const readyCount =
    results?.filter((result) => result.status === 'ready').length ?? 0;
  const reviewCount = results?.filter((result) => !result.ready).length ?? 0;
  const skippedCount =
    results?.filter((result) => result.status === 'skipped').length ?? 0;
  const completeCount =
    runResults?.filter((result) => result.status === 'complete').length ?? 0;
  const runningCount =
    runResults?.filter((result) => result.status === 'running').length ?? 0;
  const pausedCount =
    runResults?.filter((result) => result.status === 'paused').length ?? 0;
  const runReviewCount =
    runResults?.filter(
      (result) =>
        result.status === 'blocked' ||
        result.status === 'cancelled' ||
        result.status === 'failed',
    ).length ?? 0;
  const runSkippedCount =
    runResults?.filter((result) => result.status === 'skipped').length ?? 0;

  return (
    <div className={styles.flowTestPanel}>
      <div>
        <strong>Flow preview</strong>
        <p>
          Test safely, then run supported wait, extract, confirmed set-value,
          and confirmed click steps on the source page.
        </p>
      </div>
      <div className={styles.flowPanelActions}>
        {onTest ? (
          <button
            className={styles.testAutomation}
            disabled={!generatedCodeInSync || testing || running}
            type="button"
            onClick={onTest}
          >
            {testing ? 'Testing flow...' : 'Test flow'}
          </button>
        ) : null}
        {onRun ? (
          <button
            className={styles.runAutomation}
            disabled={
              !generatedCodeInSync ||
              running ||
              testing ||
              (runRequiresConfirmation && !runConfirmed)
            }
            type="button"
            onClick={onRun}
          >
            {running ? 'Running flow...' : 'Run flow'}
          </button>
        ) : null}
        {onRunToSelected ? (
          <button
            className={styles.runAutomation}
            disabled={
              !generatedCodeInSync ||
              running ||
              testing ||
              (runToSelectedRequiresConfirmation && !runConfirmed)
            }
            title={
              selectedNodeLabel
                ? `Run through ${selectedNodeLabel}`
                : 'Run through the selected node'
            }
            type="button"
            onClick={onRunToSelected}
          >
            {running ? 'Running...' : 'Run to selected'}
          </button>
        ) : null}
        {running || pausedRun ? (
          <button
            className={styles.runAutomation}
            type="button"
            onClick={onStopRun}
          >
            Stop run
          </button>
        ) : null}
      </div>
      {pausedRun ? (
        <div className={styles.flowPausePanel} aria-live="polite">
          <div>
            <strong>Paused before {pausedRun.label}</strong>
            <p>Review the source page, then continue or stop this run.</p>
          </div>
          <button
            className={styles.runAutomation}
            type="button"
            onClick={onContinuePausedRun}
          >
            Continue
          </button>
        </div>
      ) : null}
      {(onRun || onRunToSelected) &&
      (runRequiresConfirmation || runToSelectedRequiresConfirmation) ? (
        <label className={`${styles.runConfirmation} ${styles.flowRunConfirm}`}>
          <input
            aria-label="Confirm flow actions"
            checked={runConfirmed}
            type="checkbox"
            onChange={(event) =>
              onRunConfirmChange(event.currentTarget.checked)
            }
          />
          <span>
            Confirm click, set-value, and download steps before running this
            flow
          </span>
        </label>
      ) : null}
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
      {runResults ? (
        <div className={styles.flowTestResults} aria-live="polite">
          <span>
            {completeCount} complete, {runReviewCount} need review
            {runningCount > 0 ? `, ${runningCount} running` : ''}
            {pausedCount > 0 ? `, ${pausedCount} paused` : ''}
            {runSkippedCount > 0 ? `, ${runSkippedCount} skipped` : ''}
          </span>
          <ol>
            {runResults.map((result) => (
              <li
                className={`${styles.flowTestStep} ${flowRunStepClass(
                  result.status,
                )}`}
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

      {BLUEPRINT_NODE_LIBRARY_GROUPS.map((group) => (
        <div className={styles.librarySection} key={group.label}>
          <span className={styles.libraryGroup}>{group.label}</span>
          <div className={styles.libraryActions}>
            {group.actions.map((action) => (
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
        </div>
      ))}
    </aside>
  );
}

type BlueprintFlowCanvasProps = {
  editable: boolean;
  flowNodeStatusByNodeId: Record<string, BlueprintFlowNodeStatus>;
  nodes: BlueprintNode[];
  pendingNodeIds?: readonly string[] | undefined;
  recipe: BlueprintRecipe;
  selectedNodeId?: string | undefined;
  testingFlow: boolean;
  onMoveNodeLayout(nodeId: string, point: BlueprintLayoutPoint): void;
  onSelectNode(nodeId: string): void;
};

function BlueprintFlowCanvas({
  editable,
  flowNodeStatusByNodeId,
  nodes,
  pendingNodeIds,
  recipe,
  selectedNodeId,
  testingFlow,
  onMoveNodeLayout,
  onSelectNode,
}: BlueprintFlowCanvasProps) {
  const [dragState, setDragState] = useState<
    BlueprintNodeDragState | undefined
  >();
  const dragStateRef = useRef<BlueprintNodeDragState | undefined>(undefined);
  const layoutPoints = nodes.map((node, index) =>
    dragState?.nodeId === node.id
      ? dragState.currentPoint
      : layoutPointForNode(recipe, node.id, index),
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

  function startNodeDrag(
    node: BlueprintNode,
    index: number,
    event: PointerEvent<HTMLButtonElement>,
  ): void {
    if (!editable || event.button !== 0) {
      return;
    }

    capturePointer(event.currentTarget, event.pointerId);
    onSelectNode(node.id);

    const originPoint = layoutPointForNode(recipe, node.id, index);

    setCurrentDragState({
      currentPoint: originPoint,
      moved: false,
      nodeId: node.id,
      originPoint,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  }

  function moveNodeDrag(event: PointerEvent<HTMLButtonElement>): void {
    const currentDragState = dragStateRef.current;

    if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - currentDragState.startClientX;
    const deltaY = event.clientY - currentDragState.startClientY;

    setCurrentDragState({
      ...currentDragState,
      currentPoint: {
        x: currentDragState.originPoint.x + deltaX,
        y: currentDragState.originPoint.y + deltaY,
      },
      moved:
        currentDragState.moved ||
        Math.abs(deltaX) >= FLOW_DRAG_THRESHOLD ||
        Math.abs(deltaY) >= FLOW_DRAG_THRESHOLD,
    });
  }

  function finishNodeDrag(event: PointerEvent<HTMLButtonElement>): void {
    const currentDragState = dragStateRef.current;

    if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
      return;
    }

    releasePointer(event.currentTarget, event.pointerId);
    setCurrentDragState(undefined);

    if (currentDragState.moved) {
      onMoveNodeLayout(currentDragState.nodeId, currentDragState.currentPoint);
    }
  }

  function cancelNodeDrag(event: PointerEvent<HTMLButtonElement>): void {
    const currentDragState = dragStateRef.current;

    if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
      return;
    }

    releasePointer(event.currentTarget, event.pointerId);
    setCurrentDragState(undefined);
  }

  function nudgeNode(
    node: BlueprintNode,
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ): void {
    const delta = keyboardNudgeDelta(event);

    if (!editable || !delta) {
      return;
    }

    const distance = event.shiftKey ? FLOW_NODE_FAST_NUDGE : FLOW_NODE_NUDGE;
    const point = layoutPointForNode(recipe, node.id, index);

    event.preventDefault();
    onSelectNode(node.id);
    onMoveNodeLayout(node.id, {
      x: point.x + delta.x * distance,
      y: point.y + delta.y * distance,
    });
  }

  function setCurrentDragState(
    nextDragState: BlueprintNodeDragState | undefined,
  ): void {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

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
              dragging={dragState?.nodeId === position.node.id}
              node={position.node}
              selected={position.node.id === selectedNodeId}
              status={
                flowNodeStatusByNodeId[position.node.id] ??
                (testingFlow || pendingNodeIds?.includes(position.node.id)
                  ? 'pending'
                  : undefined)
              }
              style={
                {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: `${FLOW_NODE_WIDTH}px`,
                } satisfies CSSProperties
              }
              onCancelDrag={cancelNodeDrag}
              onFinishDrag={finishNodeDrag}
              onMoveDrag={moveNodeDrag}
              onNudge={(event) => nudgeNode(position.node, index, event)}
              onSelect={() => onSelectNode(position.node.id)}
              onStartDrag={(event) =>
                startNodeDrag(position.node, index, event)
              }
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

type BlueprintPreviewNodeProps = {
  dragging: boolean;
  editable: boolean;
  index: number;
  node: BlueprintNode;
  selected: boolean;
  status?: BlueprintFlowNodeStatus | undefined;
  style: CSSProperties;
  onCancelDrag(event: PointerEvent<HTMLButtonElement>): void;
  onFinishDrag(event: PointerEvent<HTMLButtonElement>): void;
  onMoveDrag(event: PointerEvent<HTMLButtonElement>): void;
  onNudge(event: KeyboardEvent<HTMLButtonElement>): void;
  onSelect(): void;
  onStartDrag(event: PointerEvent<HTMLButtonElement>): void;
};

function BlueprintPreviewNode({
  dragging,
  editable,
  index,
  node,
  selected,
  status,
  style,
  onCancelDrag,
  onFinishDrag,
  onMoveDrag,
  onNudge,
  onSelect,
  onStartDrag,
}: BlueprintPreviewNodeProps) {
  const assessment = assessBlueprintSelector(node.selectorMeta);
  const label = node.label ?? actionLabel(node.type);
  const statusClass = status ? flowNodeStatusClass(status) : '';
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
      {status ? (
        <span className={`${styles.flowNodeStatus} ${statusClass}`}>
          {flowNodeStatusLabel(status)}
        </span>
      ) : null}
    </>
  );

  return (
    <li className={styles.node} style={style}>
      {editable ? (
        <button
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
          aria-pressed={selected}
          className={`${styles.nodeButton} ${selected ? styles.selected : ''} ${
            statusClass ? styles.statusCard : ''
          } ${statusClass} ${dragging ? styles.dragging : ''}`}
          title="Drag to reposition. Use arrow keys to nudge."
          type="button"
          onKeyDown={onNudge}
          onClick={onSelect}
          onPointerCancel={onCancelDrag}
          onPointerDown={onStartDrag}
          onPointerMove={onMoveDrag}
          onPointerUp={onFinishDrag}
        >
          {content}
        </button>
      ) : (
        <div
          className={`${styles.nodeContent} ${
            statusClass ? styles.statusCard : ''
          } ${statusClass}`}
        >
          {content}
        </div>
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
  onMaxItemsChange(maxItems: number): void;
  onMoveDown(): void;
  onMoveUp(): void;
  onPauseBeforeRunChange(pauseBeforeRun: boolean): void;
  onApplySelectorSuggestion(suggestion: BlueprintSelectorSuggestion): void;
  onPickSelector?: (() => void) | undefined;
  onRequireVisibleChange(requireVisible: boolean): void;
  onRemove(): void;
  onReviewedChange(reviewed: boolean): void;
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
  onMaxItemsChange,
  onMoveDown,
  onMoveUp,
  onPauseBeforeRunChange,
  onApplySelectorSuggestion,
  onPickSelector,
  onRequireVisibleChange,
  onRemove,
  onReviewedChange,
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
            onMaxItemsChange={onMaxItemsChange}
            onPauseBeforeRunChange={onPauseBeforeRunChange}
            onRequireVisibleChange={onRequireVisibleChange}
            onReviewedChange={onReviewedChange}
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
          <span>Confirm action on source page</span>
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
          {result.action === 'click' ? (
            <span>
              Blueprint clicks are synthetic: event.isTrusted === false.
            </span>
          ) : null}
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
  onMaxItemsChange(maxItems: number): void;
  onPauseBeforeRunChange(pauseBeforeRun: boolean): void;
  onRequireVisibleChange(requireVisible: boolean): void;
  onReviewedChange(reviewed: boolean): void;
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
  onMaxItemsChange,
  onPauseBeforeRunChange,
  onRequireVisibleChange,
  onReviewedChange,
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

      {'pauseBeforeRun' in node ? (
        <label className={styles.enabledField}>
          <input
            aria-label="Pause before running this node"
            checked={node.pauseBeforeRun}
            disabled={!generatedCodeInSync}
            type="checkbox"
            onChange={(event) =>
              onPauseBeforeRunChange(event.currentTarget.checked)
            }
          />
          <span>Pause before run</span>
        </label>
      ) : null}

      {'timeoutMs' in node ? (
        <label className={styles.inspectorField}>
          <span>Timeout</span>
          <input
            aria-label="Automation timeout"
            disabled={!generatedCodeInSync}
            inputMode="numeric"
            max={60000}
            min={250}
            pattern="[0-9]*"
            type="text"
            value={node.timeoutMs}
            onChange={(event) => {
              const value = Number.parseInt(
                event.currentTarget.value.replace(/\D/g, ''),
                10,
              );

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

      {node.type === 'extract-list' ? (
        <>
          <label className={styles.inspectorField}>
            <span>Variable</span>
            <input
              aria-label="Automation list variable name"
              disabled={!generatedCodeInSync}
              value={node.variableName}
              onChange={(event) =>
                onVariableNameChange(event.currentTarget.value)
              }
            />
          </label>
          <label className={styles.inspectorField}>
            <span>Max items</span>
            <input
              aria-label="Automation max list items"
              disabled={!generatedCodeInSync}
              inputMode="numeric"
              max={500}
              min={1}
              pattern="[0-9]*"
              type="text"
              value={node.maxItems}
              onChange={(event) => {
                const value = Number.parseInt(
                  event.currentTarget.value.replace(/\D/g, ''),
                  10,
                );

                if (Number.isFinite(value)) {
                  onMaxItemsChange(clampExtractListMaxItems(value));
                }
              }}
            />
          </label>
        </>
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
        <>
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
          <label className={styles.enabledField}>
            <input
              aria-label="Mark custom code as reviewed"
              checked={node.reviewed}
              disabled={!generatedCodeInSync}
              type="checkbox"
              onChange={(event) =>
                onReviewedChange(event.currentTarget.checked)
              }
            />
            <span>Reviewed custom code</span>
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

function runningFlowStep(node: BlueprintNode): BlueprintFlowRunStep {
  return {
    details: [],
    id: node.id,
    label: node.label ?? actionLabel(node.type),
    status: 'running',
    summary: 'Running',
  };
}

function pausedFlowStep(node: BlueprintNode): BlueprintFlowRunStep {
  return {
    details: ['Review the source page before continuing this step.'],
    id: node.id,
    label: node.label ?? actionLabel(node.type),
    status: 'paused',
    summary: 'Paused',
  };
}

function cancelledFlowStep(node: BlueprintNode): BlueprintFlowRunStep {
  return {
    details: ['The flow run was stopped before this step completed.'],
    id: node.id,
    label: node.label ?? actionLabel(node.type),
    status: 'cancelled',
    summary: 'Stopped',
  };
}

function flowRunStepClass(status: BlueprintFlowRunStep['status']): string {
  switch (status) {
    case 'blocked':
    case 'cancelled':
    case 'failed':
      return styles.testReview ?? '';
    case 'complete':
      return styles.testReady ?? '';
    case 'paused':
    case 'running':
    case 'skipped':
      return styles.testSkipped ?? '';
  }
}

function flowNodeStatusClass(status: BlueprintFlowNodeStatus): string {
  switch (status) {
    case 'blocked':
    case 'cancelled':
      return styles.flowBlocked ?? '';
    case 'complete':
      return styles.flowComplete ?? '';
    case 'failed':
      return styles.flowFailed ?? '';
    case 'pending':
      return styles.flowPending ?? '';
    case 'ready':
      return styles.flowReady ?? '';
    case 'review':
      return styles.flowReview ?? '';
    case 'paused':
    case 'running':
      return styles.flowRunning ?? '';
    case 'skipped':
      return styles.flowSkipped ?? '';
  }
}

function flowNodeStatusLabel(status: BlueprintFlowNodeStatus): string {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'cancelled':
      return 'Stopped';
    case 'complete':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Pending';
    case 'ready':
      return 'Ready';
    case 'review':
      return 'Review';
    case 'paused':
      return 'Paused';
    case 'running':
      return 'Running';
    case 'skipped':
      return 'Skipped';
  }
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
    ...('maxItems' in node ? { maxItems: node.maxItems } : {}),
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
  runId?: string,
): BlueprintAutomationNodeRunInput {
  return {
    ...automationNodeTestInput(node),
    ...(confirmed ? { confirmAction: true } : {}),
    ...(runId ? { runId } : {}),
    ...('timeoutMs' in node ? { timeoutMs: node.timeoutMs } : {}),
    ...(node.label ? { label: node.label } : {}),
  };
}

function canRunManualAutomationNode(node: BlueprintAutomationNode): boolean {
  return (
    node.type === 'wait-for-element' ||
    node.type === 'extract-text' ||
    node.type === 'extract-list' ||
    node.type === 'set-value' ||
    node.type === 'click'
  );
}

function canRunFlowAutomationNode(node: BlueprintAutomationNode): boolean {
  return canRunManualAutomationNode(node) || node.type === 'download-json';
}

function flowNodesUntil(
  nodes: readonly BlueprintNode[],
  untilNodeId?: string,
): BlueprintNode[] {
  if (!untilNodeId) {
    return [...nodes];
  }

  const targetIndex = nodes.findIndex((node) => node.id === untilNodeId);

  return targetIndex >= 0 ? nodes.slice(0, targetIndex + 1) : [...nodes];
}

function flowRequiresRunConfirmationForNodes(
  nodes: readonly BlueprintNode[],
): boolean {
  return nodes.some(
    (node) =>
      node.enabled && isAutomationNode(node) && requiresRunConfirmation(node),
  );
}

function layoutPointForNode(
  recipe: BlueprintRecipe,
  nodeId: string,
  index: number,
): BlueprintLayoutPoint {
  return recipe.graph.layout[nodeId] ?? { x: index * 220, y: 0 };
}

function keyboardNudgeDelta(
  event: KeyboardEvent<HTMLButtonElement>,
): { x: -1 | 0 | 1; y: -1 | 0 | 1 } | undefined {
  switch (event.key) {
    case 'ArrowDown':
      return { x: 0, y: 1 };
    case 'ArrowLeft':
      return { x: -1, y: 0 };
    case 'ArrowRight':
      return { x: 1, y: 0 };
    case 'ArrowUp':
      return { x: 0, y: -1 };
    default:
      return undefined;
  }
}

function capturePointer(element: HTMLButtonElement, pointerId: number): void {
  if (typeof element.setPointerCapture !== 'function') {
    return;
  }

  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Some test and page contexts expose PointerEvent without capture support.
  }
}

function releasePointer(element: HTMLButtonElement, pointerId: number): void {
  if (typeof element.releasePointerCapture !== 'function') {
    return;
  }

  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // The pointer may already have been released by the browser.
  }
}

function shouldPauseBeforeRun(node: BlueprintNode): boolean {
  return isAutomationNode(node) && node.pauseBeforeRun;
}

function requiresRunConfirmation(node: BlueprintAutomationNode): boolean {
  return (
    node.type === 'click' ||
    node.type === 'download-json' ||
    node.type === 'set-value'
  );
}

function downloadPreview(value: unknown): string {
  const json = JSON.stringify(value, null, 2);

  if (!json) {
    return 'null';
  }

  return json.length <= 160 ? json : json.slice(0, 159).trimEnd();
}

function parseExtractedListValue(value: string | undefined): unknown {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createBlueprintRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'The source page run failed.';
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

function clampExtractListMaxItems(value: number): number {
  return Math.min(500, Math.max(1, Math.round(value)));
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
