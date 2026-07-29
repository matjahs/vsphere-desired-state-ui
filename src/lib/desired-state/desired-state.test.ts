import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  compareHosts,
  deepMerge,
  flattenLeaves,
  isHostLocalPath,
  listHostIds,
  majorityVote,
  promoteToProfile,
  pruneRedundantOverride,
  resolveHost,
  applyValueToHosts,
  setAsHostSpecific,
  setAsOverride,
  getLayerForPath,
  type DesiredStateDocument,
} from "./index";

const samplePath = join(process.cwd(), "export-settings-1784547718044.json");
const sample = JSON.parse(readFileSync(samplePath, "utf8")) as DesiredStateDocument;

describe("identity / host-local", () => {
  it("classifies IP and hostname as host-local", () => {
    expect(isHostLocalPath("esx.network.vmknics[vmk0].ip.ipv4_address")).toBe(true);
    expect(isHostLocalPath("esx.network.net_stacks[defaultTcpipStack].host_name")).toBe(true);
    expect(isHostLocalPath("esx.authentication.user_accounts[root].password_hash")).toBe(true);
    expect(isHostLocalPath("esx.network.vmknics[vmk0].mtu")).toBe(false);
  });
});

describe("merge + resolve", () => {
  it("lists hosts from override and specific", () => {
    const ids = listHostIds(sample);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(ids).toContain("ec9c4d56-e312-065e-62a4-6553df69a916");
  });

  it("merges arrays by identity key", () => {
    const base = {
      esx: {
        network: {
          vmknics: [{ device: "vmk0", mtu: 1500 }],
        },
      },
    };
    const overlay = {
      esx: {
        network: {
          vmknics: [{ device: "vmk0", mtu: 9000, ip: { ipv4_address: "10.0.0.1" } }],
        },
      },
    };
    const merged = deepMerge(base, overlay);
    const nics = (merged.esx as { network: { vmknics: { device: string; mtu: number; ip: { ipv4_address: string } }[] } }).network.vmknics;
    expect(nics).toHaveLength(1);
    expect(nics[0].mtu).toBe(9000);
    expect(nics[0].ip.ipv4_address).toBe("10.0.0.1");
  });

  it("resolves host with override IP", () => {
    const hostId = "18134d56-be81-cc35-71e7-e8830feced96";
    const effective = resolveHost(sample, hostId);
    const leaves = flattenLeaves(effective);
    expect(leaves.get("esx.network.vmknics[vmk0].ip.ipv4_address")).toBe("10.1.1.103");
  });
});

describe("compareHosts", () => {
  it("flags host-local IPs separately from drift", () => {
    const hostIds = listHostIds(sample).slice(0, 3);
    const rows = compareHosts(sample, { hostIds, hideHostLocal: false });
    const ipRow = rows.find((r) => r.path.includes("ipv4_address") && r.path.includes("vmk0"));
    expect(ipRow).toBeDefined();
    expect(ipRow!.kind).toBe("host-local");
  });

  it("can filter to drift only", () => {
    const hostIds = listHostIds(sample).slice(0, 3);
    const rows = compareHosts(sample, { hostIds, onlyDrift: true, hideHostLocal: true });
    expect(rows.every((r) => r.kind === "drift" || r.kind === "missing")).toBe(true);
  });
});

describe("rectify", () => {
  it("applyValueToHosts updates overrides", () => {
    const hostIds = listHostIds(sample).slice(0, 2);
    const path = "esx.network.vmknics[vmk0].mtu";
    const next = applyValueToHosts(sample, hostIds, path, 9000);
    for (const id of hostIds) {
      const effective = resolveHost(next, id);
      expect(flattenLeaves(effective).get(path)).toBe(9000);
    }
  });

  it("promoteToProfile writes profile and can strip matching override", () => {
    const hostIds = listHostIds(sample).slice(0, 2);
    const path = "esx.system.system_time.enabled";
    const next = promoteToProfile(sample, hostIds, path, true);
    expect(flattenLeaves(next.profile).get(path)).toBe(true);
  });

  it("majorityVote aligns outliers", () => {
    const hostIds = [
      "18134d56-be81-cc35-71e7-e8830feced96",
      "1f714d56-7db2-0e83-41e6-4fa7c60d20ff",
      "3d864d56-6cea-7a4b-fcec-8eaf186486c0",
    ];
    // Inject an outlier MTU on one host
    let doc = applyValueToHosts(sample, [hostIds[0]], "esx.network.vmknics[vmk0].mtu", 9999);
    doc = applyValueToHosts(doc, [hostIds[1], hostIds[2]], "esx.network.vmknics[vmk0].mtu", 1500);
    const fixed = majorityVote(doc, hostIds, "esx.network.vmknics[vmk0].mtu");
    expect(flattenLeaves(resolveHost(fixed, hostIds[0])).get("esx.network.vmknics[vmk0].mtu")).toBe(1500);
  });

  it("pruneRedundantOverride removes matching leaf", () => {
    const hostId = "18134d56-be81-cc35-71e7-e8830feced96";
    let doc = applyValueToHosts(sample, [hostId], "esx.system.system_time.enabled", true);
    // profile already has enabled:true — prune should remove override leaf
    doc = pruneRedundantOverride(doc, hostId, "esx.system.system_time.enabled");
    const overrideVal = doc["host-override"]?.[hostId]
      ? flattenLeaves(doc["host-override"]![hostId]).get("esx.system.system_time.enabled")
      : undefined;
    expect(overrideVal).toBeUndefined();
  });

  it("setAsOverride pins effective value and clears specific", () => {
    const hostId = "3d864d56-6cea-7a4b-fcec-8eaf186486c0";
    const path = "esx.network.net_stacks[defaultTcpipStack].host_name";
    // hostname currently lives under host-specific in the sample
    expect(getLayerForPath(sample, hostId, path)).toBe("specific");

    const next = setAsOverride(sample, [hostId], path);
    expect(getLayerForPath(next, hostId, path)).toBe("override");
    expect(
      flattenLeaves(next["host-specific"]![hostId]).get(path),
    ).toBeUndefined();
    expect(flattenLeaves(resolveHost(next, hostId)).get(path)).toBe(
      flattenLeaves(resolveHost(sample, hostId)).get(path),
    );
  });

  it("setAsHostSpecific pins effective value and clears override", () => {
    const hostId = "18134d56-be81-cc35-71e7-e8830feced96";
    const path = "esx.network.vmknics[vmk0].ip.ipv4_address";
    expect(getLayerForPath(sample, hostId, path)).toBe("override");

    const next = setAsHostSpecific(sample, [hostId], path);
    expect(getLayerForPath(next, hostId, path)).toBe("specific");
    expect(
      flattenLeaves(next["host-override"]![hostId]).get(path),
    ).toBeUndefined();
    expect(flattenLeaves(resolveHost(next, hostId)).get(path)).toBe("10.1.1.103");
  });
});