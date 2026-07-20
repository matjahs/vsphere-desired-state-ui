export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface ReferenceHost {
  uuid?: string;
  build?: string;
  patch?: string;
  update?: string;
  version?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesiredStateMetadata {
  tags?: string[];
  author?: string;
  description?: string;
  source_file?: string;
  reference_host?: ReferenceHost;
  reference_vcenter?: JsonObject;
  [key: string]: JsonValue | ReferenceHost | undefined;
}

export interface DesiredStateDocument {
  $schema?: string;
  profile: JsonObject;
  metadata?: DesiredStateMetadata;
  "host-override"?: Record<string, JsonObject>;
  "host-specific"?: Record<string, JsonObject>;
}

export type ConfigLayer = "profile" | "override" | "specific" | "none";

export type DiffKind = "match" | "host-local" | "drift" | "missing";

export interface DiffCell {
  hostId: string;
  value: unknown;
  layer: ConfigLayer;
  present: boolean;
}

export interface DiffRow {
  path: string;
  displayPath: string;
  section: string;
  kind: DiffKind;
  cells: DiffCell[];
  profileValue: unknown;
}

export interface HostInfo {
  uuid: string;
  displayName: string;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}