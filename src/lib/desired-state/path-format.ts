/** Human-readable labels for known Desired State path segments. */
const SEGMENT_LABELS: Record<string, string> = {
  esx: "ESX",
  nsx: "NSX",
  vsan: "vSAN",
  esx_update: "ESX Update",
  hbr: "HBR",
  spherelet: "Spherelet",
  network: "Network",
  storage: "Storage",
  system: "System",
  vmkernel: "VMkernel",
  network_vds: "vSphere Distributed Switch",
  network_vss: "vSphere Standard Switch",
  authorization: "Authorization",
  authentication: "Authentication",
  advanced_options: "Advanced options",
  health: "Health",
  syslog: "Syslog",
  services: "Services",
  security: "Security",
  identity: "Identity",
  graphics: "Graphics",
  hardware: "Hardware",
  vmknics: "VMkernel adapters",
  net_stacks: "TCP/IP stacks",
  firewall_rule_sets: "Firewall rulesets",
  switches: "Switches",
  module_settings: "Module settings",
  user_vars: "User variables",
  user_accounts: "User accounts",
  nfs_v3_datastores: "NFS v3 datastores",
  nfs_v41_datastores: "NFS v4.1 datastores",
  block_devices: "Block devices",
  permissions: "Permissions",
  system_time: "System time",
  ntp_config: "NTP",
  routing_config: "Routing",
  enabled_services: "Enabled services",
  vds_port: "VDS port",
  ip: "IP",
  dns: "DNS",
  ipv6: "IPv6",
  mem: "Memory",
  net: "Net",
  misc: "Misc",
  power: "Power",
  VMFS3: "VMFS3",
};

const FIELD_LABELS: Record<string, string> = {
  ip_route_default_gateway: "Default gateway",
  ipv4_address: "IPv4 address",
  ipv4_subnet_mask: "IPv4 subnet mask",
  ipv6_address: "IPv6 address",
  ipv6_enabled: "IPv6 enabled",
  host_name: "Hostname",
  name_server: "DNS server",
  search_domain: "Search domain",
  portgroup_name: "Port group",
  switch_name: "Switch name",
  inventory_path: "Inventory path",
  port_connection_type: "Port connection",
  net_stack_instance_key: "Network stack",
  mac_mode: "MAC mode",
  password_hash: "Password hash",
  module_name: "Module",
  option_name: "Option",
  integer_value: "Integer value",
  volume_name: "Volume name",
  perennial_reserved: "Perennially reserved",
  ipv4_default_gateway: "IPv4 default gateway",
  dhcp_dns: "DHCP DNS",
  auto_configuration_enabled: "Autoconfiguration",
};

export interface PathSegment {
  kind: "product" | "section" | "collection" | "instance" | "field" | "node";
  raw: string;
  label: string;
  /** Present for array identity segments like [vmk0] */
  instanceId?: string;
}

export interface ParsedConfigPath {
  path: string;
  segments: PathSegment[];
  /** Short title for the leaf setting */
  title: string;
  /** Breadcrumb trail excluding the leaf */
  trail: string[];
}

function humanizeSnake(raw: string): string {
  if (FIELD_LABELS[raw]) return FIELD_LABELS[raw];
  if (SEGMENT_LABELS[raw]) return SEGMENT_LABELS[raw];
  return raw
    .replace(/_/g, " ")
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\bIp\b/g, "IP")
    .replace(/\bDns\b/g, "DNS")
    .replace(/\bVds\b/g, "VDS")
    .replace(/\bNtp\b/g, "NTP")
    .replace(/\bMtu\b/g, "MTU")
    .replace(/\bMac\b/g, "MAC");
}

/**
 * Parse a Desired State leaf path into labeled segments for display.
 * Example: esx.network.vmknics[vmk0].ip_route_default_gateway
 */
export function parseConfigPath(path: string): ParsedConfigPath {
  const segments: PathSegment[] = [];
  const re = /([^.\[\]]+)|\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  let lastCollection: string | null = null;
  let index = 0;

  while ((match = re.exec(path)) !== null) {
    if (match[1] !== undefined) {
      const raw = match[1];
      lastCollection = raw;
      let kind: PathSegment["kind"] = "node";
      if (index === 0) kind = "product";
      else if (index === 1) kind = "section";
      else if (
        raw in SEGMENT_LABELS ||
        raw.endsWith("s") ||
        raw.includes("_")
      ) {
        // Heuristic: known collections or plural-ish names
        const knownCollections = new Set([
          "vmknics",
          "net_stacks",
          "switches",
          "module_settings",
          "user_vars",
          "user_accounts",
          "nfs_v3_datastores",
          "nfs_v41_datastores",
          "firewall_rule_sets",
          "permissions",
          "block_devices",
          "server",
          "name_server",
          "search_domain",
        ]);
        kind = knownCollections.has(raw) ? "collection" : "node";
      }
      if (FIELD_LABELS[raw]) kind = "field";

      segments.push({
        kind,
        raw,
        label: humanizeSnake(raw),
      });
      index += 1;
    } else if (match[2] !== undefined) {
      const id = match[2];
      segments.push({
        kind: "instance",
        raw: `[${id}]`,
        label: id,
        instanceId: id,
      });
      // Mark previous as collection if not already
      if (lastCollection && segments.length >= 2) {
        const prev = segments[segments.length - 2];
        if (prev.kind === "node") prev.kind = "collection";
      }
    }
  }

  // Last non-instance segment is typically the field
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].kind !== "instance") {
      if (segments[i].kind === "node" || segments[i].kind === "collection") {
        segments[i].kind = "field";
        segments[i].label = humanizeSnake(segments[i].raw);
      }
      break;
    }
  }

  const title =
    [...segments].reverse().find((s) => s.kind === "field" || s.kind === "node")
      ?.label ?? path;
  const trail = segments
    .filter((s) => s.kind !== "field")
    .map((s) => (s.kind === "instance" ? s.label : s.label));

  return { path, segments, title, trail };
}