"use client";

import { HostsList } from "@/components/hosts/host-views";
import { Stack, Typography } from "@mui/material";

export default function HostsPage() {
  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h6">Hosts</Typography>
        <Typography variant="body2" color="text.secondary">
          Browse effective configuration for each host (profile + override +
          specific).
        </Typography>
      </div>
      <HostsList />
    </Stack>
  );
}