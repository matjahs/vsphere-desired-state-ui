"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  compareHosts,
  collectSections,
  summarizeDiff,
} from "@/lib/desired-state/diff";
import { getHostInfo } from "@/lib/desired-state/resolve";
import type { DiffRow } from "@/lib/desired-state/types";
import { useDocumentStore } from "@/lib/store";
import { HostPicker } from "./host-picker";
import { RectifyToolbar } from "./rectify-toolbar";
import { CompareDataGrid } from "./compare-data-grid";

const SECTION_LABELS: Record<string, string> = {
  network: "Network",
  storage: "Storage",
  system: "System",
  vmkernel: "VMkernel",
  network_vds: "VDS",
  authorization: "AuthZ",
  authentication: "AuthN",
  advanced_options: "Advanced",
  nsx: "NSX",
  esx_update: "Updates",
};

function sectionLabel(id: string): string {
  return SECTION_LABELS[id] ?? id.replace(/_/g, " ");
}

export function CompareView() {
  const { document, selectedHostIds } = useDocumentStore();
  const [onlyDrift, setOnlyDrift] = useState(true);
  const [hideHostLocal, setHideHostLocal] = useState(true);
  const [section, setSection] = useState<string>("all");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [sourceHostId, setSourceHostId] = useState<string | null>(null);

  const sections = useMemo(() => {
    if (!document) return [];
    return collectSections(document, selectedHostIds);
  }, [document, selectedHostIds]);

  const rows = useMemo(() => {
    if (!document || selectedHostIds.length < 2) return [];
    return compareHosts(document, {
      hostIds: selectedHostIds,
      onlyDrift,
      hideHostLocal,
      section: section === "all" ? null : section,
    });
  }, [document, selectedHostIds, onlyDrift, hideHostLocal, section]);

  const summary = useMemo(() => {
    if (!document || selectedHostIds.length < 2) {
      return { match: 0, drift: 0, hostLocal: 0, missing: 0 };
    }
    const all = compareHosts(document, {
      hostIds: selectedHostIds,
      onlyDrift: false,
      hideHostLocal: false,
    });
    return summarizeDiff(all);
  }, [document, selectedHostIds]);

  const hostColumns = useMemo(() => {
    if (!document) return [];
    return selectedHostIds.map((id) => ({
      id,
      label: getHostInfo(document, id).displayName,
    }));
  }, [document, selectedHostIds]);

  const selectedRows: DiffRow[] = useMemo(
    () =>
      selectedPaths
        .map((path) => rows.find((r) => r.path === path))
        .filter((r): r is DiffRow => Boolean(r)),
    [rows, selectedPaths],
  );

  if (!document) {
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          Compare ESX hosts
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 480, mx: "auto" }}
        >
          Import a Desired State export or load the sample to visually compare
          2–4 hosts and rectify drift.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <HostPicker />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8.5 }}>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{
                  alignItems: { sm: "center" },
                  justifyContent: "space-between",
                  mb: 1.5,
                }}
              >
                <Typography variant="subtitle2">Compare filters</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Chip size="small" color="error" label={`${summary.drift} drift`} />
                  <Chip size="small" color="warning" label={`${summary.missing} missing`} />
                  <Chip size="small" color="info" label={`${summary.hostLocal} host-local`} />
                  <Chip size="small" color="success" label={`${summary.match} match`} />
                </Stack>
              </Stack>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                Section
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={section}
                onChange={(_, value: string | null) => {
                  if (value) setSection(value);
                }}
                sx={{
                  flexWrap: "wrap",
                  gap: 0.75,
                  mb: 1.5,
                  "& .MuiToggleButton-root": {
                    textTransform: "none",
                    borderRadius: "16px !important",
                    border: "1px solid",
                    borderColor: "divider",
                    px: 1.25,
                    py: 0.25,
                    "&.Mui-selected": {
                      borderColor: "primary.main",
                    },
                  },
                }}
              >
                <ToggleButton value="all">All</ToggleButton>
                {sections.map((s) => (
                  <ToggleButton key={s} value={s}>
                    {sectionLabel(s)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Divider sx={{ mb: 1.5 }} />

              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip
                  clickable
                  color={onlyDrift ? "error" : "default"}
                  variant={onlyDrift ? "filled" : "outlined"}
                  label="Drift & missing only"
                  onClick={() => setOnlyDrift((v) => !v)}
                />
                <Chip
                  clickable
                  color={hideHostLocal ? "info" : "default"}
                  variant={hideHostLocal ? "filled" : "outlined"}
                  label="Hide host-local"
                  onClick={() => setHideHostLocal((v) => !v)}
                />
              </Stack>
            </Paper>

            {selectedHostIds.length < 2 ? (
              <Alert severity="warning">
                Select at least 2 hosts to compare.
              </Alert>
            ) : (
              <CompareDataGrid
                rows={rows}
                hosts={hostColumns}
                selectedPaths={selectedPaths}
                onSelectedPathsChange={setSelectedPaths}
              />
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 3.5 }}>
          <RectifyToolbar
            rows={selectedRows}
            sourceHostId={sourceHostId}
            onSourceHostChange={setSourceHostId}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}