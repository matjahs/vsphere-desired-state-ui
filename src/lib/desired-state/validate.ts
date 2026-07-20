import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { DesiredStateDocument, ValidateResult } from "./types";

let validatorPromise: Promise<(data: unknown) => ValidateResult> | null = null;

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) return [];
  return errors.map((err) => {
    const path = err.instancePath || "/";
    return `${path}: ${err.message ?? "invalid"}`;
  });
}

/** Convert POSIX character classes (used in vSphere schema) to JS RegExp. */
function posixToJsPattern(pattern: string): string {
  return pattern
    .replace(/\[\[:alnum:\]\]/g, "[A-Za-z0-9]")
    .replace(/\[\[:alpha:\]\]/g, "[A-Za-z]")
    .replace(/\[\[:digit:\]\]/g, "[0-9]")
    .replace(/\[\[:space:\]\]/g, "\\s")
    .replace(/\[\[:word:\]\]/g, "\\w")
    .replace(/\[\[:xdigit:\]\]/g, "[0-9A-Fa-f]")
    .replace(/\[\[:punct:\]\]/g, "[!-/:-@[-`{-~]")
    .replace(/\[\[:lower:\]\]/g, "[a-z]")
    .replace(/\[\[:upper:\]\]/g, "[A-Z]");
}

function safeRegExp(str: string, flags?: string): RegExp {
  const converted = posixToJsPattern(str);
  try {
    return new RegExp(converted, flags);
  } catch {
    // Skip patterns AJV/JS cannot compile
    return /(?:)/;
  }
}

async function loadSchema(): Promise<object> {
  if (typeof window !== "undefined") {
    const res = await fetch("/schemas/desired-state-schema.json");
    if (!res.ok) throw new Error(`Failed to load schema: ${res.status}`);
    return res.json();
  }

  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const schemaPath = join(process.cwd(), "schemas", "desired-state-schema.json");
  const raw = await readFile(schemaPath, "utf8");
  return JSON.parse(raw) as object;
}

export async function getValidator(): Promise<(data: unknown) => ValidateResult> {
  if (!validatorPromise) {
    validatorPromise = (async () => {
      const schema = await loadSchema();
      const ajv = new Ajv2020({
        allErrors: true,
        strict: false,
        validateSchema: false,
        logger: false,
        code: {
          regExp: Object.assign(safeRegExp, { code: "new RegExp" }),
        },
      });
      addFormats(ajv);
      // VMware custom formats
      ajv.addFormat("vmodl2-long", true);
      ajv.addFormat("vmodl2-double", true);
      ajv.addFormat("int64", true);
      ajv.addFormat("double", true);

      const validate = ajv.compile(schema);

      return (data: unknown): ValidateResult => {
        const valid = validate(data);
        return {
          valid: Boolean(valid),
          errors: formatErrors(validate.errors),
        };
      };
    })();
  }
  return validatorPromise;
}

export async function validateDocument(
  doc: DesiredStateDocument,
): Promise<ValidateResult> {
  const validate = await getValidator();
  return validate(doc);
}

export function isDesiredStateDocument(value: unknown): value is DesiredStateDocument {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.profile === "object" && obj.profile !== null;
}