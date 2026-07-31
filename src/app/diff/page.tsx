"use client";

import { ChangesView } from "@/components/diff/changes-view";
import { Stack, Typography } from "@mui/material";

export default function DiffPage() {
  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h6">Your changes</Typography>
        <Typography variant="body2" color="text.secondary">
          Leaf-path and JSON diff against the document as loaded (or last
          successful export). Host-vs-host drift stays on Compare.
        </Typography>
      </div>
      <ChangesView />
    </Stack>
  );
}
