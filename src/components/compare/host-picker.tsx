"use client";

import { Button, Chip, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { listHosts } from "@/lib/desired-state/resolve";
import { useDocumentStore } from "@/lib/store";
import { shortUuid } from "@/lib/utils";

export function HostPicker() {
  const { document, selectedHostIds, setSelectedHostIds } = useDocumentStore();
  if (!document) return null;

  const hosts = listHosts(document);

  function toggle(uuid: string) {
    if (selectedHostIds.includes(uuid)) {
      setSelectedHostIds(selectedHostIds.filter((id) => id !== uuid));
      return;
    }
    if (selectedHostIds.length >= 4) return;
    setSelectedHostIds([...selectedHostIds, uuid]);
  }

  function selectAll() {
    setSelectedHostIds(hosts.slice(0, 4).map((h) => h.uuid));
  }

  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mr: 0.5 }}>
          Hosts
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {selectedHostIds.length}/4
        </Typography>

        {hosts.map((host) => {
          const selected = selectedHostIds.includes(host.uuid);
          return (
            <Tooltip
              key={host.uuid}
              title={`${host.displayName} (${shortUuid(host.uuid)}…)`}
            >
              <Chip
                size="small"
                clickable
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                label={host.displayName}
                onClick={() => toggle(host.uuid)}
                sx={{ maxWidth: 220 }}
              />
            </Tooltip>
          );
        })}

        <Button size="small" onClick={selectAll} sx={{ ml: "auto" }}>
          Select 4
        </Button>
      </Stack>
    </Paper>
  );
}