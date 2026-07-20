"use client";

import { use } from "react";
import Link from "next/link";
import { Button, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { HostDetail } from "@/components/hosts/host-views";

export default function HostDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);

  return (
    <Stack spacing={2}>
      <Button
        component={Link}
        href="/hosts"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: "flex-start" }}
      >
        All hosts
      </Button>
      <HostDetail uuid={decodeURIComponent(uuid)} />
    </Stack>
  );
}