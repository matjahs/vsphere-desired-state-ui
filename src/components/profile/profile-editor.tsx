"use client";

import { useMemo, useState } from "react";
import {
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { getValueAtPath, setValueAtPath } from "@/lib/desired-state/resolve";
import type { JsonObject } from "@/lib/desired-state/types";
import { useDocumentStore } from "@/lib/store";

type Section = "network" | "storage" | "advanced";

export function ProfileEditor() {
  const { document, updateDocument } = useDocumentStore();
  const [section, setSection] = useState<Section>("network");

  const profile = document?.profile;

  const ntpServers = useMemo(() => {
    if (!profile) return "";
    const servers = getValueAtPath(
      profile,
      "esx.system.system_time.ntp_config.server",
    ) as { hostname?: string }[] | undefined;
    if (!Array.isArray(servers)) return "";
    return servers.map((s) => s.hostname).filter(Boolean).join(", ");
  }, [profile]);

  const dnsServers = useMemo(() => {
    if (!profile) return "";
    const stacks = getValueAtPath(profile, "esx.network.net_stacks") as
      | { key?: string; dns?: { name_server?: string[] } }[]
      | undefined;
    const def = stacks?.find((s) => s.key === "defaultTcpipStack");
    return (def?.dns?.name_server ?? []).join(", ");
  }, [profile]);

  const searchDomain = useMemo(() => {
    if (!profile) return "";
    const stacks = getValueAtPath(profile, "esx.network.net_stacks") as
      | { key?: string; dns?: { search_domain?: string[] } }[]
      | undefined;
    const def = stacks?.find((s) => s.key === "defaultTcpipStack");
    return (def?.dns?.search_domain ?? []).join(", ");
  }, [profile]);

  if (!document || !profile) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          Load a Desired State document to edit the shared profile.
        </Typography>
      </Paper>
    );
  }

  function patchProfile(path: string, value: unknown) {
    updateDocument((doc) => ({
      ...doc,
      profile: setValueAtPath(doc.profile, path, value),
    }));
  }

  function updateNtpServers(text: string) {
    const hostnames = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    patchProfile(
      "esx.system.system_time.ntp_config.server",
      hostnames.map((hostname) => ({ command: "SERVER", hostname })),
    );
  }

  function updateDns(text: string) {
    const servers = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateDocument((doc) => {
      let profileNext = structuredClone(doc.profile) as JsonObject;
      const stacks =
        (getValueAtPath(profileNext, "esx.network.net_stacks") as JsonObject[]) ??
        [];
      const idx = stacks.findIndex(
        (s) => (s as { key?: string }).key === "defaultTcpipStack",
      );
      if (idx >= 0) {
        const stack = { ...(stacks[idx] as JsonObject) };
        const dns = { ...((stack.dns as JsonObject) ?? {}) };
        dns.name_server = servers;
        stack.dns = dns;
        stacks[idx] = stack;
        profileNext = setValueAtPath(profileNext, "esx.network.net_stacks", stacks);
      }
      return { ...doc, profile: profileNext };
    });
  }

  function updateSearch(text: string) {
    const domains = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateDocument((doc) => {
      let profileNext = structuredClone(doc.profile) as JsonObject;
      const stacks =
        (getValueAtPath(profileNext, "esx.network.net_stacks") as JsonObject[]) ??
        [];
      const idx = stacks.findIndex(
        (s) => (s as { key?: string }).key === "defaultTcpipStack",
      );
      if (idx >= 0) {
        const stack = { ...(stacks[idx] as JsonObject) };
        const dns = { ...((stack.dns as JsonObject) ?? {}) };
        dns.search_domain = domains;
        stack.dns = dns;
        stacks[idx] = stack;
        profileNext = setValueAtPath(profileNext, "esx.network.net_stacks", stacks);
      }
      return { ...doc, profile: profileNext };
    });
  }

  const vmknics =
    (getValueAtPath(profile, "esx.network.vmknics") as {
      device?: string;
      mtu?: number;
      vds_port?: { portgroup_name?: string; switch_name?: string };
    }[]) ?? [];

  const nfsV3 =
    (getValueAtPath(profile, "esx.storage.nfs_v3_datastores") as {
      volume_name?: string;
      hostname?: string;
      remote_share?: string;
      read_only?: boolean;
      connections?: number;
    }[]) ?? [];

  const nfsV41 =
    (getValueAtPath(profile, "esx.storage.nfs_v41_datastores") as {
      volume_name?: string;
      hostnames?: string[];
      remote_share?: string;
      auth_type?: string;
      read_only?: boolean;
      connections?: number;
    }[]) ?? [];

  return (
    <Stack spacing={2}>
      <Tabs
        value={section}
        onChange={(_, value: Section) => setSection(value)}
        variant="scrollable"
      >
        <Tab value="network" label="Network" />
        <Tab value="storage" label="Storage" />
        <Tab value="advanced" label="Metadata" />
      </Tabs>

      {section === "network" && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              DNS & NTP
            </Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="NTP servers (comma-separated)"
                value={ntpServers}
                onChange={(e) => updateNtpServers(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Name servers"
                value={dnsServers}
                onChange={(e) => updateDns(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Search domains"
                value={searchDomain}
                onChange={(e) => updateSearch(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              VMkernel adapters
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Device</TableCell>
                    <TableCell>MTU</TableCell>
                    <TableCell>Portgroup</TableCell>
                    <TableCell>Switch</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vmknics.map((nic) => (
                    <TableRow key={nic.device}>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {nic.device}
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          value={nic.mtu ?? ""}
                          onChange={(e) => {
                            const mtu = Number(e.target.value);
                            patchProfile(
                              `esx.network.vmknics[${nic.device}].mtu`,
                              mtu,
                            );
                          }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {nic.vds_port?.portgroup_name}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {nic.vds_port?.switch_name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}

      {section === "storage" && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              NFS v3 datastores
            </Typography>
            {nfsV3.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No NFS v3 datastores in profile.
              </Typography>
            ) : (
              <List dense>
                {nfsV3.map((ds) => (
                  <ListItem key={ds.volume_name} divider>
                    <ListItemText
                      primary={ds.volume_name}
                      secondary={`${ds.hostname ?? "—"}:${ds.remote_share ?? "—"}`}
                      slotProps={{
                        primary: {
                          sx: {
                            fontFamily: "var(--font-geist-mono), monospace",
                          },
                          variant: "body2",
                        },
                        secondary: {
                          sx: {
                            fontFamily: "var(--font-geist-mono), monospace",
                          },
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              NFS v4.1 datastores
            </Typography>
            {nfsV41.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No NFS v4.1 datastores in profile.
              </Typography>
            ) : (
              <List dense>
                {nfsV41.map((ds) => (
                  <ListItem key={ds.volume_name} divider>
                    <ListItemText
                      primary={ds.volume_name}
                      secondary={`${(ds.hostnames ?? []).join(", ") || "—"}:${ds.remote_share ?? "—"}`}
                      slotProps={{
                        primary: {
                          sx: {
                            fontFamily: "var(--font-geist-mono), monospace",
                          },
                          variant: "body2",
                        },
                        secondary: {
                          sx: {
                            fontFamily: "var(--font-geist-mono), monospace",
                          },
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Stack>
      )}

      {section === "advanced" && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            Metadata
          </Typography>
          <Stack spacing={2}
              sx={{ mt: 1 }}>
            <TextField
              label="Description"
              value={String(document.metadata?.description ?? "")}
              onChange={(e) =>
                updateDocument((doc) => ({
                  ...doc,
                  metadata: { ...doc.metadata, description: e.target.value },
                }))
              }
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
            <TextField
              label="Author"
              value={String(document.metadata?.author ?? "")}
              onChange={(e) =>
                updateDocument((doc) => ({
                  ...doc,
                  metadata: { ...doc.metadata, author: e.target.value },
                }))
              }
              fullWidth
              size="small"
            />
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}