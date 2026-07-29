import { describe, expect, it } from "vitest";
import {
  locateJsonPointer,
  pointerFromValidationError,
  splitJsonPointer,
} from "./json-pointer-locate";

describe("json-pointer-locate", () => {
  it("parses AJV error strings", () => {
    expect(
      pointerFromValidationError(
        "/host-override/abc/esx/storage/block_devices: must be array",
      ),
    ).toBe("/host-override/abc/esx/storage/block_devices");
  });

  it("splits pointers", () => {
    expect(splitJsonPointer("/host-override/abc/esx")).toEqual([
      "host-override",
      "abc",
      "esx",
    ]);
  });

  it("locates nested keys in pretty JSON", () => {
    const text = JSON.stringify(
      {
        "host-override": {
          "18134d56-be81-cc35-71e7-e8830feced96": {
            esx: {
              storage: {
                block_devices: { device: "x" },
              },
            },
          },
        },
      },
      null,
      2,
    );

    const loc = locateJsonPointer(
      text,
      "/host-override/18134d56-be81-cc35-71e7-e8830feced96/esx/storage/block_devices",
    );
    expect(loc).not.toBeNull();
    expect(text.split("\n")[loc!.line - 1]).toContain('"block_devices"');
  });
});
