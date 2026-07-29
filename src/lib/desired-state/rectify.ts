import { isHostLocalPath } from "./identity";
import { deepEqual } from "./merge";
import {
  deleteValueAtPath,
  getValueAtPath,
  resolveHost,
  setValueAtPath,
} from "./resolve";
import type { DesiredStateDocument, JsonObject } from "./types";

function ensureOverride(doc: DesiredStateDocument, hostId: string): JsonObject {
  if (!doc["host-override"]) doc["host-override"] = {};
  if (!doc["host-override"][hostId]) doc["host-override"][hostId] = {};
  return doc["host-override"][hostId];
}

function ensureSpecific(doc: DesiredStateDocument, hostId: string): JsonObject {
  if (!doc["host-specific"]) doc["host-specific"] = {};
  if (!doc["host-specific"][hostId]) doc["host-specific"][hostId] = {};
  return doc["host-specific"][hostId];
}

function writeHostValue(
  doc: DesiredStateDocument,
  hostId: string,
  path: string,
  value: unknown,
): DesiredStateDocument {
  const next = structuredClone(doc);
  if (isHostLocalPath(path)) {
    const specific = ensureSpecific(next, hostId);
    next["host-specific"]![hostId] = setValueAtPath(specific, path, value);
    // Remove from override if present
    if (next["host-override"]?.[hostId]) {
      next["host-override"][hostId] = deleteValueAtPath(
        next["host-override"][hostId],
        path,
      );
    }
  } else {
    const override = ensureOverride(next, hostId);
    next["host-override"]![hostId] = setValueAtPath(override, path, value);
  }
  return next;
}

/** Apply a value to all selected hosts. */
export function applyValueToHosts(
  doc: DesiredStateDocument,
  hostIds: string[],
  path: string,
  value: unknown,
): DesiredStateDocument {
  let next = structuredClone(doc);
  for (const hostId of hostIds) {
    next = writeHostValue(next, hostId, path, value);
  }
  return next;
}

/** Copy path value from source host to other selected hosts. */
export function copyFromHost(
  doc: DesiredStateDocument,
  hostIds: string[],
  sourceHostId: string,
  path: string,
): DesiredStateDocument {
  const sourceEffective = resolveHost(doc, sourceHostId);
  const value = getValueAtPath(sourceEffective, path);
  if (value === undefined) return doc;

  const targets = hostIds.filter((id) => id !== sourceHostId);
  return applyValueToHosts(doc, targets, path, value);
}

/** Promote a value into profile and strip matching keys from overrides. */
export function promoteToProfile(
  doc: DesiredStateDocument,
  hostIds: string[],
  path: string,
  value: unknown,
): DesiredStateDocument {
  let next = structuredClone(doc);
  next.profile = setValueAtPath(next.profile, path, value);

  for (const hostId of hostIds) {
    if (next["host-override"]?.[hostId]) {
      const current = getValueAtPath(next["host-override"][hostId], path);
      if (deepEqual(current, value)) {
        next["host-override"][hostId] = deleteValueAtPath(
          next["host-override"][hostId],
          path,
        );
      }
    }
    if (next["host-specific"]?.[hostId] && !isHostLocalPath(path)) {
      const current = getValueAtPath(next["host-specific"][hostId], path);
      if (deepEqual(current, value)) {
        next["host-specific"][hostId] = deleteValueAtPath(
          next["host-specific"][hostId],
          path,
        );
      }
    }
  }

  return next;
}

/**
 * Pin each host's effective value on host-override and clear the same path
 * from host-specific (so the layer is unambiguously "override").
 */
export function setAsOverride(
  doc: DesiredStateDocument,
  hostIds: string[],
  path: string,
): DesiredStateDocument {
  let next = structuredClone(doc);
  for (const hostId of hostIds) {
    const value = getValueAtPath(resolveHost(next, hostId), path);
    if (value === undefined) continue;

    const override = ensureOverride(next, hostId);
    next["host-override"]![hostId] = setValueAtPath(override, path, value);

    if (next["host-specific"]?.[hostId]) {
      next["host-specific"][hostId] = deleteValueAtPath(
        next["host-specific"][hostId],
        path,
      );
    }
  }
  return next;
}

/**
 * Pin each host's effective value on host-specific and clear the same path
 * from host-override (so the layer is unambiguously "specific").
 */
export function setAsHostSpecific(
  doc: DesiredStateDocument,
  hostIds: string[],
  path: string,
): DesiredStateDocument {
  let next = structuredClone(doc);
  for (const hostId of hostIds) {
    const value = getValueAtPath(resolveHost(next, hostId), path);
    if (value === undefined) continue;

    const specific = ensureSpecific(next, hostId);
    next["host-specific"]![hostId] = setValueAtPath(specific, path, value);

    if (next["host-override"]?.[hostId]) {
      next["host-override"][hostId] = deleteValueAtPath(
        next["host-override"][hostId],
        path,
      );
    }
  }
  return next;
}

/** Move a path from override into host-specific for one host (legacy helper). */
export function demoteToHostSpecific(
  doc: DesiredStateDocument,
  hostId: string,
  path: string,
): DesiredStateDocument {
  return setAsHostSpecific(doc, [hostId], path);
}

/** Remove override leaf when it equals profile. */
export function pruneRedundantOverride(
  doc: DesiredStateDocument,
  hostId: string,
  path: string,
): DesiredStateDocument {
  const next = structuredClone(doc);
  const override = next["host-override"]?.[hostId];
  if (!override) return next;

  const overrideValue = getValueAtPath(override, path);
  const profileValue = getValueAtPath(next.profile, path);
  if (overrideValue === undefined) return next;
  if (!deepEqual(overrideValue, profileValue)) return next;

  next["host-override"]![hostId] = deleteValueAtPath(override, path);
  return next;
}

/** Prune all redundant override leaves for selected hosts that match profile. */
export function pruneAllRedundant(
  doc: DesiredStateDocument,
  hostIds: string[],
  path: string,
): DesiredStateDocument {
  let next = doc;
  for (const hostId of hostIds) {
    next = pruneRedundantOverride(next, hostId, path);
  }
  return next;
}

/** Apply majority value among selected hosts to outliers. */
export function majorityVote(
  doc: DesiredStateDocument,
  hostIds: string[],
  path: string,
): DesiredStateDocument {
  const values: { hostId: string; value: unknown }[] = [];

  for (const hostId of hostIds) {
    const effective = resolveHost(doc, hostId);
    const value = getValueAtPath(effective, path);
    if (value !== undefined) values.push({ hostId, value });
  }

  if (values.length < 2) return doc;

  // Count by JSON serialization
  const counts = new Map<string, { value: unknown; count: number; hosts: string[] }>();
  for (const { hostId, value } of values) {
    const key = JSON.stringify(value);
    const entry = counts.get(key) ?? { value, count: 0, hosts: [] };
    entry.count += 1;
    entry.hosts.push(hostId);
    counts.set(key, entry);
  }

  let best: { value: unknown; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  if (!best || best.count < 2) return doc;

  const outliers = values
    .filter((v) => !deepEqual(v.value, best!.value))
    .map((v) => v.hostId);

  if (outliers.length === 0) return doc;
  return applyValueToHosts(doc, outliers, path, best.value);
}

/** Demote all host-local paths currently sitting in overrides for a host. */
export function demoteAllHostLocalInOverride(
  doc: DesiredStateDocument,
  hostId: string,
  paths: string[],
): DesiredStateDocument {
  let next = doc;
  for (const path of paths) {
    if (isHostLocalPath(path)) {
      next = demoteToHostSpecific(next, hostId, path);
    }
  }
  return next;
}