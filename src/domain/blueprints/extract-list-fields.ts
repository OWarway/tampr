import type { BlueprintExtractListField } from './recipe';

const FIELD_LINE_PATTERN =
  /^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+?)(?:\s+@([A-Za-z_:][A-Za-z0-9_:.-]*))?$/;

export function formatBlueprintExtractListFieldsInput(
  fields: readonly BlueprintExtractListField[] | undefined,
): string {
  return (fields ?? [])
    .map((field) =>
      field.source === 'attribute' && field.attribute
        ? `${field.name} = ${field.selector} @${field.attribute}`
        : `${field.name} = ${field.selector}`,
    )
    .join('\n');
}

export function parseBlueprintExtractListFieldsInput(
  value: string,
): BlueprintExtractListField[] {
  return value
    .split(/\r?\n/)
    .map((line) => parseBlueprintExtractListFieldLine(line))
    .filter((field) => field !== undefined)
    .slice(0, 20);
}

function parseBlueprintExtractListFieldLine(
  line: string,
): BlueprintExtractListField | undefined {
  const match = FIELD_LINE_PATTERN.exec(line.trim());

  if (!match) {
    return undefined;
  }

  const [, name, selector, attribute] = match;
  const trimmedSelector = selector?.trim();

  if (!name || !trimmedSelector) {
    return undefined;
  }

  return attribute
    ? {
        attribute,
        name,
        selector: trimmedSelector,
        source: 'attribute',
      }
    : {
        name,
        selector: trimmedSelector,
        source: 'text',
      };
}
