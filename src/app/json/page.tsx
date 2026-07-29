"use client";

import { JsonEditorView } from "@/components/json/json-editor-view";
import { Stack, Typography } from "@mui/material";

export default function JsonPage() {
  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h6">Raw JSON</Typography>
        <Typography variant="body2" color="text.secondary">
          Edit the Desired State document directly and validate against the
          exported schema before importing back into vCenter.
        </Typography>
      </div>
      <JsonEditorView />
    </Stack>
  );
}