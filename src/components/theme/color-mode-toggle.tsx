"use client";

import { useEffect, useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import SettingsBrightnessOutlinedIcon from "@mui/icons-material/SettingsBrightnessOutlined";

type Mode = "light" | "dark" | "system";

const OPTIONS: { value: Mode; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System",
    icon: <SettingsBrightnessOutlinedIcon fontSize="small" />,
  },
  {
    value: "light",
    label: "Light",
    icon: <LightModeOutlinedIcon fontSize="small" />,
  },
  {
    value: "dark",
    label: "Dark",
    icon: <DarkModeOutlinedIcon fontSize="small" />,
  },
];

export function ColorModeToggle() {
  const { mode, setMode, systemMode } = useColorScheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !mode) {
    return (
      <IconButton size="small" aria-label="Color mode" disabled>
        <SettingsBrightnessOutlinedIcon fontSize="small" />
      </IconButton>
    );
  }

  const resolved = mode === "system" ? systemMode : mode;
  const CurrentIcon =
    resolved === "dark" ? DarkModeOutlinedIcon : LightModeOutlinedIcon;

  return (
    <>
      <Tooltip title="Color mode">
        <IconButton
          size="small"
          aria-label="Color mode"
          aria-controls={anchorEl ? "color-mode-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={anchorEl ? "true" : undefined}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <CurrentIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id="color-mode-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={mode === option.value}
            onClick={() => {
              setMode(option.value);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}