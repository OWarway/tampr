import { z } from 'zod';

import { BlueprintSelectorMetaSchema } from '../blueprint-selectors';
import {
  BLUEPRINT_CSS_ACTIONS,
  blueprintNodeLabel,
  type BlueprintAutomationAction,
  type BlueprintCssAction,
  type BlueprintNodeAction,
} from './actions';
export { BLUEPRINT_NODE_TYPES } from './actions';

export const BLUEPRINT_RECIPE_VERSION = 1;

export type BlueprintNodeType = BlueprintNodeAction;

const BlueprintIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    'Blueprint IDs must contain letters, numbers, underscores, or hyphens.',
  );

export const BlueprintNodeIdSchema = BlueprintIdentifierSchema;
export const BlueprintEdgeIdSchema = BlueprintIdentifierSchema;

export const BlueprintLayoutPointSchema = z.object({
  x: z.number().int().min(-100_000).max(100_000),
  y: z.number().int().min(-100_000).max(100_000),
});

export const BlueprintAutomationTimeoutMsSchema = z
  .number()
  .int()
  .min(250)
  .max(60_000);

export const BlueprintVariableNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[A-Za-z_$][A-Za-z0-9_$]*$/,
    'Blueprint variable names must be valid JavaScript identifiers.',
  );

export const BlueprintExtractListMaxItemsSchema = z
  .number()
  .int()
  .min(1)
  .max(500);

export const BlueprintExtractListFieldSchema = z
  .object({
    name: BlueprintVariableNameSchema,
    selector: z.string().trim().min(1).max(1_000),
    source: z.enum(['text', 'attribute']).default('text'),
    attribute: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z_:][A-Za-z0-9_:.-]*$/)
      .optional(),
  })
  .superRefine((field, context) => {
    if (field.source === 'attribute' && !field.attribute) {
      context.addIssue({
        code: 'custom',
        message: 'Attribute extraction fields need an attribute name.',
      });
    }
  });

const BlueprintElementNodeBaseSchema = z.object({
  id: BlueprintNodeIdSchema,
  enabled: z.boolean().default(true),
  label: z.string().trim().min(1).max(120).optional(),
  selector: z.string().trim().min(1).max(2_000),
  selectorMeta: BlueprintSelectorMetaSchema,
});

export const BlueprintCssNodeSchema = BlueprintElementNodeBaseSchema.extend({
  type: z.enum(BLUEPRINT_CSS_ACTIONS),
});

export const BlueprintWaitForElementNodeSchema =
  BlueprintElementNodeBaseSchema.extend({
    type: z.literal('wait-for-element'),
    pauseBeforeRun: z.boolean().default(false),
    requireVisible: z.boolean().default(true),
    timeoutMs: BlueprintAutomationTimeoutMsSchema.default(5_000),
  });

export const BlueprintClickNodeSchema = BlueprintElementNodeBaseSchema.extend({
  type: z.literal('click'),
  pauseBeforeRun: z.boolean().default(false),
  requireVisible: z.boolean().default(true),
  timeoutMs: BlueprintAutomationTimeoutMsSchema.default(5_000),
});

export const BlueprintSetValueNodeSchema =
  BlueprintElementNodeBaseSchema.extend({
    type: z.literal('set-value'),
    pauseBeforeRun: z.boolean().default(false),
    requireVisible: z.boolean().default(true),
    timeoutMs: BlueprintAutomationTimeoutMsSchema.default(5_000),
    value: z.string().max(10_000).default(''),
  });

export const BlueprintExtractTextNodeSchema =
  BlueprintElementNodeBaseSchema.extend({
    type: z.literal('extract-text'),
    pauseBeforeRun: z.boolean().default(false),
    requireVisible: z.boolean().default(true),
    timeoutMs: BlueprintAutomationTimeoutMsSchema.default(5_000),
    variableName: BlueprintVariableNameSchema.default('text'),
  });

export const BlueprintExtractListNodeSchema =
  BlueprintElementNodeBaseSchema.extend({
    type: z.literal('extract-list'),
    fields: z.array(BlueprintExtractListFieldSchema).max(20).default([]),
    maxItems: BlueprintExtractListMaxItemsSchema.default(50),
    pauseBeforeRun: z.boolean().default(false),
    requireVisible: z.boolean().default(true),
    timeoutMs: BlueprintAutomationTimeoutMsSchema.default(5_000),
    variableName: BlueprintVariableNameSchema.default('items'),
  });

export const BlueprintDownloadJsonNodeSchema =
  BlueprintElementNodeBaseSchema.extend({
    type: z.literal('download-json'),
    filename: z.string().trim().min(1).max(160).default('tampr-blueprint.json'),
    pauseBeforeRun: z.boolean().default(false),
    valueFrom: BlueprintVariableNameSchema.optional(),
  });

export const BlueprintCustomCodeNodeSchema =
  BlueprintElementNodeBaseSchema.extend({
    type: z.literal('custom-code'),
    code: z
      .string()
      .max(10_000)
      .default(
        [
          '// element is the selected page element.',
          '// values stores extracted Blueprint values.',
        ].join('\n'),
      ),
    pauseBeforeRun: z.boolean().default(false),
    requireVisible: z.boolean().default(true),
    reviewed: z.boolean().default(false),
    timeoutMs: BlueprintAutomationTimeoutMsSchema.default(5_000),
  });

export const BlueprintNodeSchema = z.discriminatedUnion('type', [
  BlueprintCssNodeSchema,
  BlueprintWaitForElementNodeSchema,
  BlueprintClickNodeSchema,
  BlueprintSetValueNodeSchema,
  BlueprintExtractTextNodeSchema,
  BlueprintExtractListNodeSchema,
  BlueprintDownloadJsonNodeSchema,
  BlueprintCustomCodeNodeSchema,
]);

export const BlueprintEdgeSchema = z.object({
  id: BlueprintEdgeIdSchema,
  fromNodeId: BlueprintNodeIdSchema,
  fromPort: z.enum(['success']).default('success'),
  toNodeId: BlueprintNodeIdSchema,
});

export const BlueprintGraphSchema = z
  .object({
    nodes: z.array(BlueprintNodeSchema).min(1).max(60),
    edges: z.array(BlueprintEdgeSchema).max(80),
    layout: z.record(BlueprintNodeIdSchema, BlueprintLayoutPointSchema),
  })
  .superRefine((graph, context) => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));

    addDuplicateIssues(
      graph.nodes.map((node) => node.id),
      'Node IDs must be unique.',
      context,
    );
    addDuplicateIssues(
      graph.edges.map((edge) => edge.id),
      'Edge IDs must be unique.',
      context,
    );

    for (const [nodeId] of Object.entries(graph.layout)) {
      if (!nodeIds.has(nodeId)) {
        context.addIssue({
          code: 'custom',
          message: `Layout references unknown node ${nodeId}.`,
        });
      }
    }

    for (const nodeId of nodeIds) {
      if (!graph.layout[nodeId]) {
        context.addIssue({
          code: 'custom',
          message: `Layout is missing node ${nodeId}.`,
        });
      }
    }

    const incomingCounts = new Map<string, number>();
    const outgoingCounts = new Map<string, number>();

    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.fromNodeId)) {
        context.addIssue({
          code: 'custom',
          message: `Edge ${edge.id} starts at unknown node ${edge.fromNodeId}.`,
        });
      }

      if (!nodeIds.has(edge.toNodeId)) {
        context.addIssue({
          code: 'custom',
          message: `Edge ${edge.id} ends at unknown node ${edge.toNodeId}.`,
        });
      }

      if (edge.fromNodeId === edge.toNodeId) {
        context.addIssue({
          code: 'custom',
          message: `Edge ${edge.id} cannot point to the same node.`,
        });
      }

      incomingCounts.set(
        edge.toNodeId,
        (incomingCounts.get(edge.toNodeId) ?? 0) + 1,
      );
      outgoingCounts.set(
        edge.fromNodeId,
        (outgoingCounts.get(edge.fromNodeId) ?? 0) + 1,
      );
    }

    for (const nodeId of nodeIds) {
      if ((incomingCounts.get(nodeId) ?? 0) > 1) {
        context.addIssue({
          code: 'custom',
          message: `Node ${nodeId} has more than one incoming edge.`,
        });
      }

      if ((outgoingCounts.get(nodeId) ?? 0) > 1) {
        context.addIssue({
          code: 'custom',
          message: `Node ${nodeId} has more than one outgoing edge.`,
        });
      }
    }

    const startNodes = graph.nodes.filter(
      (node) => (incomingCounts.get(node.id) ?? 0) === 0,
    );

    if (startNodes.length !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'Blueprint graphs need exactly one start node.',
      });
    }

    if (graph.edges.length !== graph.nodes.length - 1) {
      context.addIssue({
        code: 'custom',
        message: 'Blueprint graphs must be one straight success path for now.',
      });
    }

    const startNode = startNodes[0];

    if (!startNode) {
      return;
    }

    const visited = new Set<string>();
    let currentNodeId: string | undefined = startNode.id;

    while (currentNodeId) {
      if (visited.has(currentNodeId)) {
        context.addIssue({
          code: 'custom',
          message: 'Blueprint graph cannot contain cycles.',
        });
        return;
      }

      visited.add(currentNodeId);
      currentNodeId = graph.edges.find(
        (edge) => edge.fromNodeId === currentNodeId,
      )?.toNodeId;
    }

    if (visited.size !== graph.nodes.length) {
      context.addIssue({
        code: 'custom',
        message: 'Blueprint graph must connect every node.',
      });
    }
  });

export const BlueprintRecipeSchema = z.object({
  version: z.literal(BLUEPRINT_RECIPE_VERSION),
  name: z.string().trim().min(1).max(120),
  graph: BlueprintGraphSchema,
});

export type BlueprintNode = z.infer<typeof BlueprintNodeSchema>;
export type BlueprintCssNode = z.infer<typeof BlueprintCssNodeSchema>;
export type BlueprintAutomationNode = Extract<
  BlueprintNode,
  { type: BlueprintAutomationAction }
>;
export type BlueprintEdge = z.infer<typeof BlueprintEdgeSchema>;
export type BlueprintGraph = z.infer<typeof BlueprintGraphSchema>;
export type BlueprintLayoutPoint = z.infer<typeof BlueprintLayoutPointSchema>;
export type BlueprintExtractListField = z.infer<
  typeof BlueprintExtractListFieldSchema
>;
export type BlueprintRecipe = z.infer<typeof BlueprintRecipeSchema>;

export type BlueprintNodeUpdate = {
  enabled?: boolean;
  fields?: BlueprintExtractListField[];
  label?: string;
  maxItems?: number;
  selector?: string;
  selectorMeta?: BlueprintNode['selectorMeta'];
  filename?: string;
  code?: string;
  pauseBeforeRun?: boolean;
  requireVisible?: boolean;
  reviewed?: boolean;
  timeoutMs?: number;
  type?: BlueprintNodeType;
  value?: string;
  valueFrom?: string | null;
  variableName?: string;
};

export type MoveBlueprintNodeDirection = 'down' | 'up';

export type InsertBlueprintNodeInput = {
  afterNodeId: string;
  label?: string;
  selector: string;
  selectorMeta: BlueprintNode['selectorMeta'];
  type: BlueprintNodeType;
};

export type InsertBlueprintNodeResult = {
  nodeId: string;
  recipe: BlueprintRecipe;
};

type BuildCssBlueprintRecipeInput = {
  id: string;
  label: string;
  selector: string;
  selectorMeta: BlueprintNode['selectorMeta'];
  type: BlueprintCssAction;
};

export function buildCssBlueprintRecipe({
  id,
  label,
  selector,
  selectorMeta,
  type,
}: BuildCssBlueprintRecipeInput): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: label,
    graph: {
      nodes: [
        {
          id,
          enabled: true,
          label,
          selector,
          selectorMeta,
          type,
        },
      ],
      edges: [],
      layout: {
        [id]: { x: 160, y: 120 },
      },
    },
  });
}

export function updateBlueprintNode(
  recipe: BlueprintRecipe,
  nodeId: string,
  update: BlueprintNodeUpdate,
): BlueprintRecipe {
  let updated = false;

  const nodes = recipe.graph.nodes.map((node) => {
    if (node.id !== nodeId) {
      return node;
    }

    updated = true;

    const nextNode: Record<string, unknown> = {
      ...node,
      ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
      ...(update.fields !== undefined ? { fields: update.fields } : {}),
      ...(update.maxItems !== undefined ? { maxItems: update.maxItems } : {}),
      ...(update.selector !== undefined ? { selector: update.selector } : {}),
      ...(update.selectorMeta !== undefined
        ? { selectorMeta: update.selectorMeta }
        : {}),
      ...(update.filename !== undefined ? { filename: update.filename } : {}),
      ...(update.code !== undefined ? { code: update.code } : {}),
      ...(update.pauseBeforeRun !== undefined
        ? { pauseBeforeRun: update.pauseBeforeRun }
        : {}),
      ...(update.requireVisible !== undefined
        ? { requireVisible: update.requireVisible }
        : {}),
      ...(update.reviewed !== undefined ? { reviewed: update.reviewed } : {}),
      ...(update.timeoutMs !== undefined
        ? { timeoutMs: update.timeoutMs }
        : {}),
      ...(update.type !== undefined ? { type: update.type } : {}),
      ...(update.value !== undefined ? { value: update.value } : {}),
      ...(update.variableName !== undefined
        ? { variableName: update.variableName }
        : {}),
    };

    if (update.valueFrom !== undefined) {
      if (update.valueFrom) {
        nextNode.valueFrom = update.valueFrom;
      } else {
        delete nextNode.valueFrom;
      }
    }

    if (update.label !== undefined) {
      const label = update.label.trim();

      if (label) {
        nextNode.label = label;
      } else {
        delete nextNode.label;
      }
    }

    return nextNode;
  });

  if (!updated) {
    throw new Error(`Blueprint node ${nodeId} does not exist.`);
  }

  return BlueprintRecipeSchema.parse({
    ...recipe,
    graph: {
      ...recipe.graph,
      nodes,
    },
  });
}

export function updateBlueprintNodeLayout(
  recipe: BlueprintRecipe,
  nodeId: string,
  point: BlueprintLayoutPoint,
): BlueprintRecipe {
  if (!recipe.graph.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`Blueprint node ${nodeId} does not exist.`);
  }

  return BlueprintRecipeSchema.parse({
    ...recipe,
    graph: {
      ...recipe.graph,
      layout: {
        ...recipe.graph.layout,
        [nodeId]: normalizeBlueprintLayoutPoint(point),
      },
    },
  });
}

export function insertBlueprintNode(
  recipe: BlueprintRecipe,
  input: InsertBlueprintNodeInput,
): InsertBlueprintNodeResult {
  const linearNodes = getLinearBlueprintNodes(recipe);
  const afterIndex = linearNodes.findIndex(
    (node) => node.id === input.afterNodeId,
  );

  if (afterIndex === -1) {
    throw new Error(`Blueprint node ${input.afterNodeId} does not exist.`);
  }

  const existingNodeIds = new Set(recipe.graph.nodes.map((node) => node.id));
  const nodeId = uniqueIdentifier(`${input.type}-selection`, existingNodeIds);
  const nextNode = linearNodes[afterIndex + 1];
  const newNode = BlueprintNodeSchema.parse({
    enabled: true,
    id: nodeId,
    label: input.label?.trim() || blueprintNodeLabel(input.type),
    selector: input.selector,
    selectorMeta: input.selectorMeta,
    type: input.type,
  });
  const nodes = [
    ...linearNodes.slice(0, afterIndex + 1),
    newNode,
    ...linearNodes.slice(afterIndex + 1),
  ];
  const edges = recipe.graph.edges.filter(
    (edge) => edge.fromNodeId !== input.afterNodeId,
  );
  const existingEdgeIds = new Set(edges.map((edge) => edge.id));

  edges.push({
    id: uniqueIdentifier(`edge-${nodeId}`, existingEdgeIds),
    fromNodeId: input.afterNodeId,
    fromPort: 'success',
    toNodeId: nodeId,
  });

  if (nextNode) {
    edges.push({
      id: uniqueIdentifier(`edge-${nextNode.id}`, existingEdgeIds),
      fromNodeId: nodeId,
      fromPort: 'success',
      toNodeId: nextNode.id,
    });
  }

  return {
    nodeId,
    recipe: BlueprintRecipeSchema.parse({
      ...recipe,
      graph: {
        nodes,
        edges,
        layout: insertLayoutPoint(recipe, input.afterNodeId, nodeId),
      },
    }),
  };
}

export function removeBlueprintNode(
  recipe: BlueprintRecipe,
  nodeId: string,
): BlueprintRecipe {
  const linearNodes = getLinearBlueprintNodes(recipe);
  const removeIndex = linearNodes.findIndex((node) => node.id === nodeId);

  if (removeIndex === -1) {
    throw new Error(`Blueprint node ${nodeId} does not exist.`);
  }

  if (linearNodes.length <= 1) {
    throw new Error('Blueprints need at least one node.');
  }

  const previousNode = linearNodes[removeIndex - 1];
  const nextNode = linearNodes[removeIndex + 1];
  const nodes = linearNodes.filter((node) => node.id !== nodeId);
  const edges = recipe.graph.edges.filter(
    (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
  );
  const existingEdgeIds = new Set(edges.map((edge) => edge.id));

  if (previousNode && nextNode) {
    edges.push({
      id: uniqueIdentifier(`edge-${nextNode.id}`, existingEdgeIds),
      fromNodeId: previousNode.id,
      fromPort: 'success',
      toNodeId: nextNode.id,
    });
  }

  return BlueprintRecipeSchema.parse({
    ...recipe,
    graph: {
      nodes,
      edges,
      layout: removeLayoutPoint(recipe, nodeId),
    },
  });
}

export function moveBlueprintNode(
  recipe: BlueprintRecipe,
  nodeId: string,
  direction: MoveBlueprintNodeDirection,
): BlueprintRecipe {
  const linearNodes = getLinearBlueprintNodes(recipe);
  const currentIndex = linearNodes.findIndex((node) => node.id === nodeId);

  if (currentIndex === -1) {
    throw new Error(`Blueprint node ${nodeId} does not exist.`);
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= linearNodes.length) {
    return recipe;
  }

  const nodes = [...linearNodes];
  const movingNode = nodes[currentIndex];

  if (!movingNode) {
    throw new Error(`Blueprint node ${nodeId} does not exist.`);
  }

  nodes.splice(currentIndex, 1);
  nodes.splice(targetIndex, 0, movingNode);

  return BlueprintRecipeSchema.parse({
    ...recipe,
    graph: {
      nodes,
      edges: buildLinearEdges(nodes),
      layout: reflowLinearLayout(recipe, nodes),
    },
  });
}

export function getLinearBlueprintNodes(
  recipe: BlueprintRecipe,
): BlueprintNode[] {
  const incomingNodeIds = new Set(
    recipe.graph.edges.map((edge) => edge.toNodeId),
  );
  const nodeById = new Map(recipe.graph.nodes.map((node) => [node.id, node]));
  const startNode = recipe.graph.nodes.find(
    (node) => !incomingNodeIds.has(node.id),
  );
  const nodes: BlueprintNode[] = [];
  let currentNode: BlueprintNode | undefined = startNode;

  while (currentNode) {
    nodes.push(currentNode);

    const nextNodeId = recipe.graph.edges.find(
      (edge) => edge.fromNodeId === currentNode?.id,
    )?.toNodeId;

    currentNode = nextNodeId ? nodeById.get(nextNodeId) : undefined;
  }

  return nodes;
}

function addDuplicateIssues(
  values: readonly string[],
  message: string,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      context.addIssue({
        code: 'custom',
        message,
      });
      return;
    }

    seen.add(value);
  }
}

function insertLayoutPoint(
  recipe: BlueprintRecipe,
  afterNodeId: string,
  nodeId: string,
): BlueprintGraph['layout'] {
  const layout = { ...recipe.graph.layout };
  const afterPoint = layout[afterNodeId] ?? { x: 160, y: 120 };

  layout[nodeId] = {
    x: afterPoint.x + 220,
    y: afterPoint.y,
  };

  return layout;
}

function removeLayoutPoint(
  recipe: BlueprintRecipe,
  nodeId: string,
): BlueprintGraph['layout'] {
  const layout = { ...recipe.graph.layout };

  delete layout[nodeId];

  return layout;
}

function buildLinearEdges(nodes: readonly BlueprintNode[]): BlueprintEdge[] {
  const edges: BlueprintEdge[] = [];

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const fromNode = nodes[index];
    const toNode = nodes[index + 1];

    if (!fromNode || !toNode) {
      continue;
    }

    edges.push({
      id: `edge-${toNode.id}`,
      fromNodeId: fromNode.id,
      fromPort: 'success',
      toNodeId: toNode.id,
    });
  }

  return edges;
}

function reflowLinearLayout(
  recipe: BlueprintRecipe,
  nodes: readonly BlueprintNode[],
): BlueprintGraph['layout'] {
  const layout: BlueprintGraph['layout'] = {};
  const existingPoints = nodes
    .map((node) => recipe.graph.layout[node.id])
    .filter((point) => point !== undefined);
  const originX =
    existingPoints.length > 0
      ? Math.min(...existingPoints.map((point) => point.x))
      : 160;
  const firstNode = nodes[0];
  const originY = firstNode
    ? (recipe.graph.layout[firstNode.id]?.y ?? 120)
    : 120;

  nodes.forEach((node, index) => {
    layout[node.id] = {
      x: originX + index * 220,
      y: originY,
    };
  });

  return layout;
}

function normalizeBlueprintLayoutPoint(
  point: BlueprintLayoutPoint,
): BlueprintLayoutPoint {
  return {
    x: normalizeBlueprintLayoutCoordinate(point.x),
    y: normalizeBlueprintLayoutCoordinate(point.y),
  };
}

function normalizeBlueprintLayoutCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100_000, Math.max(-100_000, Math.round(value)));
}

function uniqueIdentifier(base: string, existing: Set<string>): string {
  const root = base
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 96);
  const fallback = root || 'blueprint-node';
  let candidate = fallback;
  let index = 2;

  while (existing.has(candidate)) {
    candidate = `${fallback}-${index}`;
    index += 1;
  }

  existing.add(candidate);

  return candidate;
}
