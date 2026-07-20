"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { ReactNode } from "react";

const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#1565c0",
          dark: "#0d47a1",
          light: "#42a5f5",
        },
        secondary: {
          main: "#455a64",
        },
        background: {
          default: "#eef2f6",
          paper: "#ffffff",
        },
        success: { main: "#2e7d32" },
        warning: { main: "#ed6c02" },
        error: { main: "#c62828" },
        info: { main: "#0277bd" },
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#64b5f6",
          dark: "#42a5f5",
          light: "#90caf9",
        },
        secondary: {
          main: "#90a4ae",
        },
        background: {
          default: "#0f1419",
          paper: "#1a222c",
        },
        success: { main: "#66bb6a" },
        warning: { main: "#ffa726" },
        error: { main: "#ef5350" },
        info: { main: "#29b6f6" },
      },
    },
  },
  typography: {
    fontFamily: [
      "var(--font-geist-sans)",
      "Roboto",
      "Helvetica",
      "Arial",
      "sans-serif",
    ].join(","),
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
    MuiChip: {
      defaultProps: { size: "small" },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: "0.75rem" },
        head: { fontWeight: 700 },
      },
    },
  },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme} defaultMode="system" modeStorageKey="ds-color-mode">
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}