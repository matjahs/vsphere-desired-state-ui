import { getArrayIdentityKey } from "./identity";
import { deepMerge } from "./merge";
import type {
  ConfigLayer,
  DesiredStateDocument,
  HostInfo,
  JsonObject,
  JsonValue,
} from "./types";

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function listHostIds(doc: DesiredStateDocument): string[] {
  const ids = new Set<string>();
  for (const id of Object.keys(doc["host-override"] ?? {})) ids.add(id);
  for (const id of Object.keys(doc["host-specific"] ?? {})) ids.add(id);
  const ref = doc.metadata?.reference_host?.uuid;
  if (ref) ids.add(ref);
  return [...ids].sort();
}

function findHostName(obj: unknown): string | undefined {
  if (!isPlainObject(obj)) return undefined;
  const esx = obj.esx;
  if (!isPlainObject(esx)) return undefined;
  const network = esx.network;
  if (!isPlainObject(network)) return undefined;
  const stacks = network.net_stacks;
  if (!Array.isArray(stacks)) return undefined;

  for (const stack of stacks) {
    if (isPlainObject(stack) && typeof stack.host_name === "string") {
      return stack.host_name;
    }
  }
  return undefined;
}

export function getHostInfo(doc: DesiredStateDocument, uuid: string): HostInfo {
  const override = doc["host-override"]?.[uuid];
  const specific = doc["host-specific"]?.[uuid];
  const effective = resolveHost(doc, uuid);

  const name =
    findHostName(specific) ??
    findHostName(override) ??
    findHostName(effective) ??
    uuid.slice(0, 8);

  return { uuid, displayName: name };
}

export function listHosts(doc: DesiredStateDocument): HostInfo[] {
  return listHostIds(doc).map((uuid) => getHostInfo(doc, uuid));
}

/** Effective config for a host: profile ← override ← specific. */
export function resolveHost(doc: DesiredStateDocument, hostId: string): JsonObject {
  let result = structuredClone(doc.profile) as JsonObject;
  const override = doc["host-override"]?.[hostId];
  if (override) result = deepMerge(result, override);
  const specific = doc["host-specific"]?.[hostId];
  if (specific) result = deepMerge(result, specific);
  return result;
}

function getAtPath(root: unknown, path: string): unknown {
  if (!path) return root;
  const tokens = tokenizePath(path);
  let current: unknown = root;

  for (const token of tokens) {
    if (current === undefined || current === null) return undefined;
    if (token.type === "prop") {
      if (!isPlainObject(current)) return undefined;
      current = current[token.name];
    } else {
      if (!Array.isArray(current)) return undefined;
      const identityKey = getArrayIdentityKey(token.arrayName);
      if (identityKey) {
        current = (current as JsonValue[]).find(
          (item) => isPlainObject(item) && String(item[identityKey]) === token.id,
        );
      } else {
        const idx = Number(token.id);
        current = Number.isFinite(idx) ? (current as JsonValue[])[idx] : undefined;
      }
    }
  }
  return current;
}

export type PathToken =
  | { type: "prop"; name: string }
  | { type: "index"; arrayName: string; id: string };

export function tokenizePath(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  const re = /([^.\[\]]+)|\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  let lastArrayName = "";

  while ((match = re.exec(path)) !== null) {
    if (match[1] !== undefined) {
      lastArrayName = match[1];
      tokens.push({ type: "prop", name: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "index", arrayName: lastArrayName, id: match[2] });
    }
  }
  return tokens;
}

export function getValueAtPath(root: unknown, path: string): unknown {
  return getAtPath(root, path);
}

/** Which layer last set a leaf path for a host. */
export function getLayerForPath(
  doc: DesiredStateDocument,
  hostId: string,
  path: string,
): ConfigLayer {
  const specific = doc["host-specific"]?.[hostId];
  if (specific && getAtPath(specific, path) !== undefined) return "specific";

  const override = doc["host-override"]?.[hostId];
  if (override && getAtPath(override, path) !== undefined) return "override";

  if (getAtPath(doc.profile, path) !== undefined) return "profile";
  return "none";
}

export function setValueAtPath(root: JsonObject, path: string, value: unknown): JsonObject {
  const result = structuredClone(root);
  const tokens = tokenizePath(path);
  if (tokens.length === 0) return result;

  let current: unknown = result;

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];

    if (token.type === "prop") {
      const obj = current as JsonObject;
      if (next.type === "index") {
        if (!Array.isArray(obj[token.name!])) obj[token.name!] = [];
        current = obj[token.name!];
      } else {
        if (!isPlainObject(obj[token.name!])) obj[token.name!] = {};
        current = obj[token.name!];
      }
    } else {
      const arr = current as JsonValue[];
      const identityKey = getArrayIdentityKey(token.arrayName!);
      let item: JsonValue | undefined;

      if (identityKey) {
        item = arr.find(
          (el) => isPlainObject(el) && String(el[identityKey]) === token.id,
        );
        if (!item) {
          item = { [identityKey]: token.id };
          arr.push(item);
        }
      } else {
        const idx = Number(token.id);
        while (arr.length <= idx) arr.push({});
        item = arr[idx];
        if (!isPlainObject(item)) {
          arr[idx] = {};
          item = arr[idx];
        }
      }
      current = item;
    }
  }

  const last = tokens[tokens.length - 1];
  if (last.type === "prop") {
    (current as JsonObject)[last.name!] = value as JsonValue;
  } else {
    const arr = current as JsonValue[];
    const identityKey = getArrayIdentityKey(last.arrayName!);
    if (identityKey && isPlainObject(value)) {
      const idx = arr.findIndex(
        (el) => isPlainObject(el) && String(el[identityKey]) === last.id,
      );
      const merged = { ...(isPlainObject(value) ? value : {}), [identityKey]: last.id };
      if (idx >= 0) arr[idx] = merged as JsonValue;
      else arr.push(merged as JsonValue);
    } else {
      const idx = Number(last.id);
      arr[idx] = value as JsonValue;
    }
  }

  return result;
}

export function deleteValueAtPath(root: JsonObject, path: string): JsonObject {
  const result = structuredClone(root);
  const tokens = tokenizePath(path);
  if (tokens.length === 0) return result;

  const parents: unknown[] = [result];
  let current: unknown = result;

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (token.type === "prop") {
      if (!isPlainObject(current) || current[token.name!] === undefined) return result;
      current = current[token.name!];
    } else {
      if (!Array.isArray(current)) return result;
      const identityKey = getArrayIdentityKey(token.arrayName!);
      if (identityKey) {
        current = (current as JsonValue[]).find(
          (el) => isPlainObject(el) && String(el[identityKey]) === token.id,
        );
      } else {
        current = (current as JsonValue[])[Number(token.id)];
      }
      if (current === undefined) return result;
    }
    parents.push(current);
  }

  const last = tokens[tokens.length - 1];
  if (last.type === "prop") {
    if (isPlainObject(current)) delete current[last.name!];
  } else if (Array.isArray(current)) {
    const identityKey = getArrayIdentityKey(last.arrayName!);
    if (identityKey) {
      const idx = current.findIndex(
        (el) => isPlainObject(el) && String(el[identityKey]) === last.id,
      );
      if (idx >= 0) current.splice(idx, 1);
    } else {
      current.splice(Number(last.id), 1);
    }
  }

  return result;
}