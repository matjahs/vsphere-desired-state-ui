"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  applyValueToHosts,
  copyFromHost,
  demoteToHostSpecific,
  majorityVote,
  promoteToProfile,
  pruneAllRedundant,
} from "@/lib/desired-state/rectify";
import { parseConfigPath } from "@/lib/desired-state/path-format";
import { getHostInfo, resolveHost, getValueAtPath } from "@/lib/desired-state/resolve";
import type { DesiredStateDocument, DiffRow } from "@/lib/desired-state/types";
import { useDocumentStore } from "@/lib/store";

interface RectifyToolbarProps {
  rows: DiffRow[];
  sourceHostId: string | null;
  onSourceHostChange: (id: string) => void;
}

function applyToAllPaths(
  doc: DesiredStateDocument,
  paths: string[],
  fn: (doc: DesiredStateDocument, path: string) => DesiredStateDocument,
): DesiredStateDocument {
  let next = doc;
  for (const path of paths) {
    next = fn(next, path);
  }
  return next;
}

export function RectifyToolbar({
  rows,
  sourceHostId,
  onSourceHostChange,
}: RectifyToolbarProps) {
  const { document, selectedHostIds, updateDocument } = useDocumentStore();
  const [message, setMessage] = useState<string | null>(null);

  if (!document || rows.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderStyle: "dashed",
          bgcolor: "action.hover",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            textTransform: "uppercase",
            letterSpacing: 0.8,
            mb: 0.5,
          }}
        >
          Rectify
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Check one or more rows to rectify.
        </Typography>
      </Paper>
    );
  }

  const primary = rows[rows.length - 1];
  const parsed = parseConfigPath(primary.path);
  const paths = rows.map((r) => r.path);
  const multi = rows.length > 1;

  const source =
    sourceHostId && selectedHostIds.includes(sourceHostId)
      ? sourceHostId
      : selectedHostIds[0];

  function run(label: string, fn: () => void) {
    fn();
    setMessage(label);
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, position: "sticky", top: 88 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", mb: 0.5 }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Rectify
        </Typography>
        <Chip
          size="small"
          color="primary"
          label={multi ? `${rows.length} paths` : "1 path"}
        />
      </Stack>

      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.25, mb: 0.75 }}>
        {multi ? `${rows.length} selected` : parsed.title}
      </Typography>

      {!multi && (
        <>
          <Breadcrumbs
            separator={
              <NavigateNextIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            }
            sx={{ mb: 0.5 }}
          >
            {parsed.segments.map((segment, i) => {
              const isLast = i === parsed.segments.length - 1;
              return (
                <Typography
                  key={`${segment.raw}-${i}`}
                  variant="caption"
                  color={isLast ? "text.primary" : "text.secondary"}
                  sx={{
                    fontWeight: isLast ? 600 : 400,
                    fontFamily:
                      segment.kind === "instance"
                        ? "var(--font-geist-mono), monospace"
                        : "inherit",
                  }}
                >
                  {segment.label}
                </Typography>
              );
            })}
          </Breadcrumbs>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{
              display: "block",
              fontFamily: "var(--font-geist-mono), monospace",
              wordBreak: "break-all",
              mb: 2,
            }}
          >
            {primary.path}
          </Typography>
        </>
      )}

      {multi && (
        <Box
          sx={{
            mb: 2,
            maxHeight: 120,
            overflow: "auto",
            pr: 0.5,
          }}
        >
          <Stack spacing={0.5}>
            {rows.map((r) => (
              <Typography
                key={r.path}
                variant="caption"
                color="text.secondary"
                sx={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  wordBreak: "break-all",
                }}
              >
                {r.displayPath}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel id="source-host-label">Source host</InputLabel>
        <Select
          labelId="source-host-label"
          label="Source host"
          value={source ?? ""}
          onChange={(e) => onSourceHostChange(String(e.target.value))}
        >
          {selectedHostIds.map((id) => (
            <MenuItem key={id} value={id}>
              {getHostInfo(document, id).displayName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Stack spacing={1}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() =>
            run(
              multi
                ? `Copied from source (${paths.length} paths)`
                : "Copied from source",
              () =>
                updateDocument((doc) =>
                  applyToAllPaths(doc, paths, (d, path) =>
                    copyFromHost(d, selectedHostIds, source, path),
                  ),
                ),
            )
          }
        >
          Copy from source
        </Button>
        <Button
          fullWidth
          variant="outlined"
          onClick={() =>
            run(
              multi
                ? `Applied to all hosts (${paths.length} paths)`
                : "Applied to all hosts",
              () =>
                updateDocument((doc) =>
                  applyToAllPaths(doc, paths, (d, path) => {
                    const effective = resolveHost(d, source);
                    const value = getValueAtPath(effective, path);
                    if (value === undefined) return d;
                    return applyValueToHosts(d, selectedHostIds, path, value);
                  }),
                ),
            )
          }
        >
          Apply to all
        </Button>
        <Button
          fullWidth
          variant="outlined"
          onClick={() =>
            run(
              multi
                ? `Promoted to profile (${paths.length} paths)`
                : "Promoted to profile",
              () =>
                updateDocument((doc) =>
                  applyToAllPaths(doc, paths, (d, path) => {
                    const effective = resolveHost(d, source);
                    const value = getValueAtPath(effective, path);
                    if (value === undefined) return d;
                    return promoteToProfile(d, selectedHostIds, path, value);
                  }),
                ),
            )
          }
        >
          Promote to profile
        </Button>
        <Button
          fullWidth
          variant="outlined"
          onClick={() =>
            run(
              multi
                ? `Majority vote applied (${paths.length} paths)`
                : "Majority vote applied",
              () =>
                updateDocument((doc) =>
                  applyToAllPaths(doc, paths, (d, path) =>
                    majorityVote(d, selectedHostIds, path),
                  ),
                ),
            )
          }
        >
          Majority vote
        </Button>
        <Button
          fullWidth
          variant="outlined"
          onClick={() =>
            run(
              multi
                ? `Pruned redundant (${paths.length} paths)`
                : "Pruned redundant overrides",
              () =>
                updateDocument((doc) =>
                  applyToAllPaths(doc, paths, (d, path) =>
                    pruneAllRedundant(d, selectedHostIds, path),
                  ),
                ),
            )
          }
        >
          Prune redundant
        </Button>
        <Button
          fullWidth
          variant="outlined"
          onClick={() =>
            run(
              multi
                ? `Demoted to host-specific (${paths.length} paths)`
                : "Demoted host-local from overrides",
              () =>
                updateDocument((doc) =>
                  applyToAllPaths(doc, paths, (d, path) => {
                    let next = d;
                    for (const id of selectedHostIds) {
                      next = demoteToHostSpecific(next, id, path);
                    }
                    return next;
                  }),
                ),
            )
          }
        >
          Demote to host-specific
        </Button>
      </Stack>

      {message && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        </Box>
      )}
    </Paper>
  );
}