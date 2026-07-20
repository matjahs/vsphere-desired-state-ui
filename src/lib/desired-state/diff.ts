import { displayPath, isHostLocalPath, sectionFromPath, getArrayIdentityKey } from "./identity";
import { deepEqual } from "./merge";
import {
  getLayerForPath,
  getValueAtPath,
  resolveHost,
} from "./resolve";
import type {
  DesiredStateDocument,
  DiffCell,
  DiffKind,
  DiffRow,
  JsonObject,
  JsonValue,
} from "./types";

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLeaf(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/** Flatten object to leaf paths using identity keys for arrays. */
export function flattenLeaves(
  obj: unknown,
  prefix = "",
  arrayContext = "",
): Map<string, unknown> {
  const leaves = new Map<string, unknown>();

  if (isLeaf(obj)) {
    if (prefix) leaves.set(prefix, obj);
    return leaves;
  }

  if (Array.isArray(obj)) {
    const identityKey = getArrayIdentityKey(arrayContext);
    obj.forEach((item, index) => {
      let segment: string;
      if (identityKey && isPlainObject(item) && item[identityKey] !== undefined) {
        segment = `[${String(item[identityKey])}]`;
      } else {
        segment = `[${index}]`;
      }
      const nextPrefix = prefix ? `${prefix}${segment}` : segment;
      const nested = flattenLeaves(item, nextPrefix, "");
      for (const [k, v] of nested) leaves.set(k, v);
    });
    return leaves;
  }

  if (isPlainObject(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) {
        const nested = flattenLeaves(value, nextPrefix, key);
        for (const [k, v] of nested) leaves.set(k, v);
      } else if (isPlainObject(value)) {
        const nested = flattenLeaves(value, nextPrefix, "");
        for (const [k, v] of nested) leaves.set(k, v);
      } else {
        leaves.set(nextPrefix, value);
      }
    }
  }

  return leaves;
}

function classifyRow(cells: DiffCell[], path: string): DiffKind {
  const present = cells.filter((c) => c.present);
  if (present.length === 0) return "missing";
  if (present.length < cells.length) {
    if (isHostLocalPath(path)) return "host-local";
    return "missing";
  }

  const first = present[0].value;
  const allEqual = present.every((c) => deepEqual(c.value, first));
  if (allEqual) return "match";
  if (isHostLocalPath(path)) return "host-local";
  return "drift";
}

export interface CompareOptions {
  hostIds: string[];
  includeProfileColumn?: boolean;
  hideHostLocal?: boolean;
  onlyDrift?: boolean;
  section?: string | null;
}

export function compareHosts(
  doc: DesiredStateDocument,
  options: CompareOptions,
): DiffRow[] {
  const { hostIds } = options;
  if (hostIds.length < 2) return [];

  const effectiveByHost = new Map<string, JsonObject>();
  const allPaths = new Set<string>();

  for (const hostId of hostIds) {
    const effective = resolveHost(doc, hostId);
    effectiveByHost.set(hostId, effective);
    for (const path of flattenLeaves(effective).keys()) {
      allPaths.add(path);
    }
  }

  // Also include profile-only paths
  for (const path of flattenLeaves(doc.profile).keys()) {
    allPaths.add(path);
  }

  const rows: DiffRow[] = [];

  for (const path of [...allPaths].sort()) {
    const section = sectionFromPath(path);
    if (options.section && options.section !== "all" && section !== options.section) {
      continue;
    }

    const cells: DiffCell[] = hostIds.map((hostId) => {
      const effective = effectiveByHost.get(hostId)!;
      const value = getValueAtPath(effective, path);
      const present = value !== undefined;
      return {
        hostId,
        value,
        layer: getLayerForPath(doc, hostId, path),
        present,
      };
    });

    const kind = classifyRow(cells, path);
    if (options.onlyDrift && kind !== "drift" && kind !== "missing") continue;
    if (options.hideHostLocal && kind === "host-local") continue;

    rows.push({
      path,
      displayPath: displayPath(path),
      section,
      kind,
      cells,
      profileValue: getValueAtPath(doc.profile, path),
    });
  }

  return rows;
}

export function summarizeDiff(rows: DiffRow[]): {
  match: number;
  drift: number;
  hostLocal: number;
  missing: number;
} {
  return {
    match: rows.filter((r) => r.kind === "match").length,
    drift: rows.filter((r) => r.kind === "drift").length,
    hostLocal: rows.filter((r) => r.kind === "host-local").length,
    missing: rows.filter((r) => r.kind === "missing").length,
  };
}

/** Collect unique sections present in a document's profile+hosts. */
export function collectSections(doc: DesiredStateDocument, hostIds: string[]): string[] {
  const sections = new Set<string>();
  for (const path of flattenLeaves(doc.profile).keys()) {
    sections.add(sectionFromPath(path));
  }
  for (const hostId of hostIds) {
    for (const path of flattenLeaves(resolveHost(doc, hostId)).keys()) {
      sections.add(sectionFromPath(path));
    }
  }
  return [...sections].sort();
}