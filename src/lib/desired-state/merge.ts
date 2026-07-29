import { getArrayIdentityKey } from "./identity";
import type { JsonObject, JsonValue } from "./types";

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function mergeArrays(base: JsonValue[], overlay: JsonValue[], arrayName: string): JsonValue[] {
  const identityKey = getArrayIdentityKey(arrayName);

  if (!identityKey) {
    // Primitive / unknown arrays: overlay replaces when non-empty
    return overlay.length > 0 ? cloneValue(overlay) : cloneValue(base);
  }

  const result = base.map((item) => cloneValue(item));
  const indexByKey = new Map<string, number>();

  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    if (isPlainObject(item) && identityKey in item) {
      indexByKey.set(String(item[identityKey]), i);
    }
  }

  for (const overlayItem of overlay) {
    if (!isPlainObject(overlayItem) || !(identityKey in overlayItem)) {
      result.push(cloneValue(overlayItem));
      continue;
    }
    const key = String(overlayItem[identityKey]);
    const existingIdx = indexByKey.get(key);
    if (existingIdx === undefined) {
      indexByKey.set(key, result.length);
      result.push(cloneValue(overlayItem));
    } else {
      const existing = result[existingIdx];
      result[existingIdx] = isPlainObject(existing)
        ? deepMerge(existing, overlayItem)
        : cloneValue(overlayItem);
    }
  }

  return result;
}

/** Deep merge overlay onto base. Arrays with identity keys merge by key. */
export function deepMerge(base: JsonObject, overlay: JsonObject): JsonObject {
  const result: JsonObject = cloneValue(base);

  for (const [key, overlayValue] of Object.entries(overlay)) {
    if (overlayValue === undefined) continue;

    const baseValue = result[key];

    if (Array.isArray(overlayValue)) {
      const baseArr = Array.isArray(baseValue) ? (baseValue as JsonValue[]) : [];
      result[key] = mergeArrays(baseArr, overlayValue as JsonValue[], key);
      continue;
    }

    if (isPlainObject(overlayValue) && isPlainObject(baseValue)) {
      result[key] = deepMerge(baseValue, overlayValue);
      continue;
    }

    result[key] = cloneValue(overlayValue);
  }

  return result;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => deepEqual(a[k], b[k]));
  }

  return false;
}