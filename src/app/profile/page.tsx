"use client";

import { ProfileEditor } from "@/components/profile/profile-editor";
import { Stack, Typography } from "@mui/material";

export default function ProfilePage() {
  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h6">Shared profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Edit cluster-wide Desired State settings applied to all hosts.
        </Typography>
      </div>
      <ProfileEditor />
    </Stack>
  );
}