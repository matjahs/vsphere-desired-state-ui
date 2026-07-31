import { flattenLeaves } from "./diff";
import { deepEqual } from "./merge";
import type { DesiredStateDocument } from "./types";

export type ChangeKind = "added" | "removed" | "changed";

export interface ChangeRow {
  path: string;
  before: unknown;
  after: unknown;
  kind: ChangeKind;
}

export interface ChangeSummary {
  added: number;
  removed: number;
  changed: number;
  total: number;
}

/** Leaf-path diff between baseline (as loaded/exported) and current document. */
export function diffDocumentChanges(
  baseline: DesiredStateDocument,
  current: DesiredStateDocument,
): ChangeRow[] {
  const beforeLeaves = flattenLeaves(baseline);
  const afterLeaves = flattenLeaves(current);
  const paths = new Set([...beforeLeaves.keys(), ...afterLeaves.keys()]);
  const rows: ChangeRow[] = [];

  for (const path of [...paths].sort()) {
    const hasBefore = beforeLeaves.has(path);
    const hasAfter = afterLeaves.has(path);
    const before = beforeLeaves.get(path);
    const after = afterLeaves.get(path);

    if (hasBefore && !hasAfter) {
      rows.push({ path, before, after: undefined, kind: "removed" });
    } else if (!hasBefore && hasAfter) {
      rows.push({ path, before: undefined, after, kind: "added" });
    } else if (!deepEqual(before, after)) {
      rows.push({ path, before, after, kind: "changed" });
    }
  }

  return rows;
}

export function summarizeChanges(rows: ChangeRow[]): ChangeSummary {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const row of rows) {
    if (row.kind === "added") added += 1;
    else if (row.kind === "removed") removed += 1;
    else changed += 1;
  }
  return { added, removed, changed, total: rows.length };
}
