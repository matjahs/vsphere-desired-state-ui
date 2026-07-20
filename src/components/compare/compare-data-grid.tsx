"use client";

import { useMemo } from "react";
import {
  Box,
  Chip,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowSelectionModel,
} from "@mui/x-data-grid";
import type { DiffKind, DiffRow } from "@/lib/desired-state/types";
import { formatValue, shortUuid } from "@/lib/utils";

const KIND_COLOR: Record<DiffKind, "success" | "info" | "error" | "warning"> = {
  match: "success",
  "host-local": "info",
  drift: "error",
  missing: "warning",
};

const KIND_BG: Record<DiffKind, string> = {
  match: "rgba(46, 125, 50, 0.05)",
  "host-local": "rgba(2, 119, 189, 0.05)",
  drift: "rgba(198, 40, 40, 0.08)",
  missing: "rgba(237, 108, 2, 0.08)",
};

const LAYER_COLOR = {
  profile: "default" as const,
  override: "warning" as const,
  specific: "info" as const,
  none: "default" as const,
};

export interface CompareHostColumn {
  id: string;
  label: string;
}

export interface CompareDataGridProps {
  rows: DiffRow[];
  hosts: CompareHostColumn[];
  selectedPaths: string[];
  onSelectedPathsChange: (paths: string[]) => void;
}

interface CompareGridRow {
  id: string;
  path: string;
  displayPath: string;
  section: string;
  kind: DiffKind;
  profileValue: unknown;
  cells: DiffRow["cells"];
  [key: string]: unknown;
}

export function CompareDataGrid({
  rows,
  hosts,
  selectedPaths,
  onSelectedPathsChange,
}: CompareDataGridProps) {
  const gridRows: CompareGridRow[] = useMemo(
    () =>
      rows.map((row) => {
        const hostValues: Record<string, string> = {};
        for (const cell of row.cells) {
          hostValues[`host_${cell.hostId}`] = cell.present
            ? formatValue(cell.value)
            : "—";
        }
        return {
          id: row.path,
          path: row.path,
          displayPath: row.displayPath,
          section: row.section,
          kind: row.kind,
          profileValue: row.profileValue,
          cells: row.cells,
          ...hostValues,
        };
      }),
    [rows],
  );

  const focusPath = selectedPaths[selectedPaths.length - 1] ?? null;
  const selectedRow = useMemo(
    () => gridRows.find((r) => r.id === focusPath) ?? null,
    [gridRows, focusPath],
  );

  const columns: GridColDef<CompareGridRow>[] = useMemo(() => {
    const cols: GridColDef<CompareGridRow>[] = [
      {
        field: "displayPath",
        headerName: "Path",
        flex: 1.4,
        minWidth: 240,
        renderCell: (params: GridRenderCellParams<CompareGridRow>) => (
          <Typography
            variant="caption"
            title={params.row.path}
            noWrap
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {params.value as string}
          </Typography>
        ),
      },
      {
        field: "kind",
        headerName: "Kind",
        width: 130,
        type: "singleSelect",
        valueOptions: ["match", "host-local", "drift", "missing"],
        renderCell: (
          params: GridRenderCellParams<CompareGridRow, DiffKind>,
        ) => (
          <Chip
            size="small"
            color={KIND_COLOR[params.value as DiffKind]}
            label={params.value}
          />
        ),
      },
      {
        field: "section",
        headerName: "Section",
        width: 120,
      },
    ];

    for (const host of hosts) {
      cols.push({
        field: `host_${host.id}`,
        headerName: host.label,
        description: host.id,
        flex: 1,
        minWidth: 140,
        renderCell: (params: GridRenderCellParams<CompareGridRow>) => (
          <Typography
            variant="caption"
            title={String(params.value ?? "")}
            noWrap
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {String(params.value ?? "")}
          </Typography>
        ),
      });
    }

    return cols;
  }, [hosts]);

  const selectionModel: GridRowSelectionModel = {
    type: "include",
    ids: new Set(selectedPaths),
  };

  return (
    <Stack spacing={1.5}>
      <Paper variant="outlined" sx={{ height: "62vh", width: "100%" }}>
        <DataGrid
          rows={gridRows}
          columns={columns}
          density="compact"
          showToolbar
          checkboxSelection
          disableRowSelectionOnClick={false}
          keepNonExistentRowsSelected
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={(model) => {
            const ids = [...model.ids].map(String);
            // Preserve relative order: previously selected first, then newly added
            const prev = selectedPaths.filter((p) => ids.includes(p));
            const added = ids.filter((p) => !selectedPaths.includes(p));
            onSelectedPathsChange([...prev, ...added]);
          }}
          getRowClassName={(params) => `kind-${params.row.kind}`}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 50 } },
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
            "& .MuiDataGrid-row.kind-drift": { bgcolor: KIND_BG.drift },
            "& .MuiDataGrid-row.kind-missing": { bgcolor: KIND_BG.missing },
            "& .MuiDataGrid-row.kind-host-local": {
              bgcolor: KIND_BG["host-local"],
            },
            "& .MuiDataGrid-row.kind-match": { bgcolor: KIND_BG.match },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
            },
          }}
        />
      </Paper>

      <Collapse in={Boolean(selectedRow) && selectedPaths.length === 1}>
        {selectedRow && selectedPaths.length === 1 && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ alignItems: "center", mb: 1.5, flexWrap: "wrap" }}
            >
              <Typography variant="subtitle2">Row detail</Typography>
              <Chip
                size="small"
                color={KIND_COLOR[selectedRow.kind]}
                label={selectedRow.kind}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  wordBreak: "break-all",
                }}
              >
                {selectedRow.path}
              </Typography>
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {selectedRow.cells.map((cell) => (
                <Paper
                  key={cell.hostId}
                  variant="outlined"
                  sx={{ p: 1.5, minWidth: 200, flex: "1 1 200px" }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mb: 1 }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {shortUuid(cell.hostId)}
                    </Typography>
                    <Chip
                      size="small"
                      color={LAYER_COLOR[cell.layer]}
                      label={cell.layer}
                      variant="outlined"
                    />
                  </Stack>
                  <Typography
                    component="pre"
                    variant="caption"
                    sx={{
                      m: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    {formatValue(cell.value)}
                  </Typography>
                </Paper>
              ))}
            </Stack>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1.5, display: "block" }}
            >
              Profile:{" "}
              <Box
                component="span"
                sx={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {formatValue(selectedRow.profileValue)}
              </Box>
            </Typography>
          </Paper>
        )}
      </Collapse>
    </Stack>
  );
}