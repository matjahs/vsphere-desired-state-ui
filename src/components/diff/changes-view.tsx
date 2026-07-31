"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from "@mui/x-data-grid";
import { useColorScheme, useTheme } from "@mui/material/styles";
import {
  diffDocumentChanges,
  summarizeChanges,
  type ChangeKind,
  type ChangeRow,
} from "@/lib/desired-state/changes";
import { useDocumentStore } from "@/lib/store";
import { formatValue } from "@/lib/utils";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false },
);

const KIND_COLOR: Record<ChangeKind, "success" | "error" | "warning"> = {
  added: "success",
  removed: "error",
  changed: "warning",
};

interface ChangeGridRow extends ChangeRow {
  id: string;
  beforeLabel: string;
  afterLabel: string;
}

export function ChangesView() {
  const { document, baseline, dirty } = useDocumentStore();
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedMode =
    mounted && mode ? (mode === "system" ? systemMode : mode) : theme.palette.mode;
  const monacoTheme = resolvedMode === "dark" ? "vs-dark" : "light";

  const changeRows = useMemo(() => {
    if (!document || !baseline) return [];
    return diffDocumentChanges(baseline, document);
  }, [document, baseline]);

  const summary = useMemo(() => summarizeChanges(changeRows), [changeRows]);

  const gridRows: ChangeGridRow[] = useMemo(
    () =>
      changeRows.map((row) => ({
        ...row,
        id: row.path,
        beforeLabel: formatValue(row.before),
        afterLabel: formatValue(row.after),
      })),
    [changeRows],
  );

  const columns: GridColDef<ChangeGridRow>[] = useMemo(
    () => [
      {
        field: "kind",
        headerName: "Kind",
        width: 110,
        type: "singleSelect",
        valueOptions: ["added", "removed", "changed"],
        renderCell: (params: GridRenderCellParams<ChangeGridRow, ChangeKind>) => (
          <Chip
            size="small"
            color={KIND_COLOR[params.value ?? "changed"]}
            label={params.value}
            variant="outlined"
          />
        ),
      },
      {
        field: "path",
        headerName: "Path",
        flex: 1.6,
        minWidth: 280,
        renderCell: (params: GridRenderCellParams<ChangeGridRow>) => (
          <Typography
            variant="caption"
            noWrap
            title={params.value as string}
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {params.value as string}
          </Typography>
        ),
      },
      {
        field: "beforeLabel",
        headerName: "Baseline",
        flex: 1,
        minWidth: 140,
        renderCell: (params: GridRenderCellParams<ChangeGridRow>) => (
          <Typography
            variant="caption"
            noWrap
            title={params.value as string}
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {params.value as string}
          </Typography>
        ),
      },
      {
        field: "afterLabel",
        headerName: "Current",
        flex: 1,
        minWidth: 140,
        renderCell: (params: GridRenderCellParams<ChangeGridRow>) => (
          <Typography
            variant="caption"
            noWrap
            title={params.value as string}
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {params.value as string}
          </Typography>
        ),
      },
    ],
    [],
  );

  const baselineText = useMemo(
    () => (baseline ? JSON.stringify(baseline, null, 2) : ""),
    [baseline],
  );
  const currentText = useMemo(
    () => (document ? JSON.stringify(document, null, 2) : ""),
    [document],
  );

  if (!document || !baseline) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          Load a document to see edits since import or last export.
        </Typography>
      </Paper>
    );
  }

  if (summary.total === 0) {
    return (
      <Stack spacing={2}>
        <Alert severity="success">
          No edits since load/export
          {dirty ? " (document marked dirty but leaf values match baseline)." : "."}
        </Alert>
        <Paper variant="outlined" sx={{ overflow: "hidden", height: "50vh" }}>
          <DiffEditor
            height="50vh"
            language="json"
            theme={monacoTheme}
            original={baselineText}
            modified={currentText}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
            }}
          />
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Chip size="small" color="warning" label={`${summary.changed} changed`} />
        <Chip size="small" color="success" label={`${summary.added} added`} />
        <Chip size="small" color="error" label={`${summary.removed} removed`} />
        <Chip size="small" variant="outlined" label={`${summary.total} total`} />
        {dirty && (
          <Chip size="small" color="info" variant="outlined" label="unsaved" />
        )}
      </Stack>

      <Paper variant="outlined" sx={{ height: 320, width: "100%" }}>
        <DataGrid
          rows={gridRows}
          columns={columns}
          density="compact"
          showToolbar
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: "kind", sort: "asc" }] },
          }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 250 },
            },
          }}
          sx={{
            border: 0,
            "& .MuiDataGrid-columnHeaders": { bgcolor: "action.hover" },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
            },
          }}
        />
      </Paper>

      <Typography variant="subtitle2">JSON diff (baseline → current)</Typography>
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <DiffEditor
          height="55vh"
          language="json"
          theme={monacoTheme}
          original={baselineText}
          modified={currentText}
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
          }}
        />
      </Paper>
    </Stack>
  );
}
