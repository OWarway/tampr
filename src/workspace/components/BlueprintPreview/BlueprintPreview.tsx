import { assessBlueprintSelector } from '../../../domain/blueprint-selectors';
import {
  getLinearBlueprintNodes,
  type BlueprintNode,
  type BlueprintRecipe,
} from '../../../domain/blueprints/recipe';

import styles from './BlueprintPreview.module.scss';

type BlueprintPreviewProps = {
  blueprint: BlueprintRecipe | undefined;
};

export function BlueprintPreview({ blueprint }: BlueprintPreviewProps) {
  if (!blueprint) {
    return null;
  }

  const nodes = getLinearBlueprintNodes(blueprint);

  return (
    <section className={styles.preview} aria-label="Blueprint preview">
      <header className={styles.header}>
        <div>
          <span>Blueprint</span>
          <strong>{blueprint.name}</strong>
        </div>
        <span className={styles.count}>
          {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
        </span>
      </header>

      <ol className={styles.flow}>
        {nodes.map((node, index) => (
          <BlueprintPreviewNode
            index={index}
            key={node.id}
            node={node}
            total={nodes.length}
          />
        ))}
      </ol>
    </section>
  );
}

type BlueprintPreviewNodeProps = {
  index: number;
  node: BlueprintNode;
  total: number;
};

function BlueprintPreviewNode({
  index,
  node,
  total,
}: BlueprintPreviewNodeProps) {
  const assessment = assessBlueprintSelector(node.selectorMeta);
  const label = node.label ?? actionLabel(node.type);

  return (
    <li
      className={`${styles.node} ${index === total - 1 ? styles.lastNode : ''}`}
    >
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
    </li>
  );
}

function actionLabel(type: BlueprintNode['type']): string {
  return type === 'hide' ? 'Hide' : 'Highlight';
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
