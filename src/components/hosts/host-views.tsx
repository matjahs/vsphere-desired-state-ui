"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Alert,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from "@mui/x-data-grid";
import { flattenLeaves } from "@/lib/desired-state/diff";
import {
  getLayerForPath,
  listHosts,
  resolveHost,
} from "@/lib/desired-state/resolve";
import type { ConfigLayer } from "@/lib/desired-state/types";
import { useDocumentStore } from "@/lib/store";
import { formatValue, shortUuid } from "@/lib/utils";

export function HostsList() {
  const { document } = useDocumentStore();
  if (!document) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          Load a document to browse hosts.
        </Typography>
      </Paper>
    );
  }

  const hosts = listHosts(document);

  return (
    <Grid container spacing={2}>
      {hosts.map((host) => (
        <Grid key={host.uuid} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined">
            <CardActionArea component={Link} href={`/hosts/${host.uuid}`}>
              <CardContent>
                <Typography variant="subtitle1"
            sx={{ fontWeight: 600 }}>
                  {host.displayName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
            sx={{ display: "block", mt: 0.5, fontFamily: "var(--font-geist-mono), monospace" }}>
                  {host.uuid}
                </Typography>
                <Stack direction="row" spacing={1}
              sx={{ mt: 2 }}>
                  <Chip
                    size="small"
                    label={
                      document["host-override"]?.[host.uuid]
                        ? "override"
                        : "no override"
                    }
                    color={
                      document["host-override"]?.[host.uuid]
                        ? "warning"
                        : "default"
                    }
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={
                      document["host-specific"]?.[host.uuid]
                        ? "specific"
                        : "no specific"
                    }
                    color={
                      document["host-specific"]?.[host.uuid]
                        ? "info"
                        : "default"
                    }
                    variant="outlined"
                  />
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

interface HostLeafRow {
  id: string;
  path: string;
  layer: ConfigLayer;
  value: string;
}

export function HostDetail({ uuid }: { uuid: string }) {
  const { document } = useDocumentStore();

  const host = useMemo(() => {
    if (!document) return null;
    return listHosts(document).find((h) => h.uuid === uuid) ?? null;
  }, [document, uuid]);

  const rows: HostLeafRow[] = useMemo(() => {
    if (!document || !host) return [];
    const effective = resolveHost(document, uuid);
    return [...flattenLeaves(effective).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, value]) => ({
        id: path,
        path,
        layer: getLayerForPath(document, uuid, path),
        value: formatValue(value),
      }));
  }, [document, host, uuid]);

  const columns: GridColDef<HostLeafRow>[] = useMemo(
    () => [
      {
        field: "path",
        headerName: "Path",
        flex: 1.6,
        minWidth: 280,
        renderCell: (params: GridRenderCellParams<HostLeafRow>) => (
          <Typography
            variant="caption"
            noWrap
            title={params.value as string}
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            {params.value as string}
          </Typography>
        ),
      },
      {
        field: "layer",
        headerName: "Layer",
        width: 120,
        type: "singleSelect",
        valueOptions: ["profile", "override", "specific", "none"],
        renderCell: (
          params: GridRenderCellParams<HostLeafRow, ConfigLayer>,
        ) => (
          <Chip
            size="small"
            label={params.value}
            color={
              params.value === "specific"
                ? "info"
                : params.value === "override"
                  ? "warning"
                  : "default"
            }
            variant="outlined"
          />
        ),
      },
      {
        field: "value",
        headerName: "Value",
        flex: 1,
        minWidth: 180,
        renderCell: (params: GridRenderCellParams<HostLeafRow>) => (
          <Typography
            variant="caption"
            noWrap
            title={params.value as string}
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            {params.value as string}
          </Typography>
        ),
      },
    ],
    [],
  );

  if (!document) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">Load a document first.</Typography>
      </Paper>
    );
  }

  if (!host) {
    return (
      <Alert severity="error">
        Host {shortUuid(uuid)} not found in this document.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6">{host.displayName}</Typography>
        <Typography
          variant="caption"
          color="text.secondary"
            sx={{ fontFamily: "var(--font-geist-mono), monospace" }}>
          {host.uuid}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ height: "70vh", width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          showToolbar
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 50 } },
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
    </Stack>
  );
}