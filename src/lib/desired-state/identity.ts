/** Array identity key by path segment pattern (last array segment name). */
const ARRAY_IDENTITY_KEYS: Record<string, string> = {
  vmknics: "device",
  net_stacks: "key",
  switches: "name",
  module_settings: "module_name",
  user_vars: "option_name",
  user_accounts: "name",
  nfs_v3_datastores: "volume_name",
  nfs_v41_datastores: "volume_name",
  firewall_rule_sets: "name",
  permissions: "principal",
  block_devices: "device",
  server: "hostname",
  name_server: "", // primitive arrays — index identity
  search_domain: "",
};

export function getArrayIdentityKey(arrayPropertyName: string): string | null {
  if (!(arrayPropertyName in ARRAY_IDENTITY_KEYS)) return null;
  const key = ARRAY_IDENTITY_KEYS[arrayPropertyName];
  return key === "" ? null : key;
}

/** Paths / leaf names that are expected to differ per host. */
const HOST_LOCAL_LEAF_NAMES = new Set([
  "ipv4_address",
  "ipv6_address",
  "host_name",
  "password_hash",
  "mac",
  "mac_address",
]);

const HOST_LOCAL_PATH_SUFFIXES = [
  ".ip.ipv4_address",
  ".ip.ipv6_address",
  ".host_name",
  ".password_hash",
  ".block_devices",
];

export function isHostLocalPath(path: string): boolean {
  const leaf = path.split(".").pop()?.replace(/\[.*?\]/g, "") ?? "";
  if (HOST_LOCAL_LEAF_NAMES.has(leaf)) return true;

  // block_devices[].device is host-local hardware id
  if (/\.block_devices\[.+\]\.device$/.test(path)) return true;

  return HOST_LOCAL_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

export function sectionFromPath(path: string): string {
  const parts = path.split(".");
  // profile.esx.network... or esx.network...
  const esxIdx = parts.indexOf("esx");
  if (esxIdx >= 0 && parts[esxIdx + 1]) return parts[esxIdx + 1];
  if (parts[0] === "nsx") return "nsx";
  if (parts[0] === "esx_update") return "esx_update";
  if (parts[0] === "vsan") return "vsan";
  return parts[0] || "other";
}

export function displayPath(path: string): string {
  return path
    .replace(/^esx\./, "")
    .replace(/\[([^\]]+)\]/g, "[$1]");
}