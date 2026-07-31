"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DataObjectIcon from "@mui/icons-material/DataObject";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import DownloadIcon from "@mui/icons-material/Download";
import { ColorModeToggle } from "@/components/theme/color-mode-toggle";
import { downloadDocument, useDocumentStore } from "@/lib/store";
import { validateDocument } from "@/lib/desired-state/validate";

const NAV = [
  { href: "/", label: "Compare" },
  { href: "/diff", label: "Diff" },
  { href: "/profile", label: "Profile" },
  { href: "/hosts", label: "Hosts" },
  { href: "/json", label: "JSON" },
];

function navIndex(pathname: string): number {
  const idx = NAV.findIndex(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href)),
  );
  return idx >= 0 ? idx : 0;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const {
    document,
    fileName,
    dirty,
    history,
    future,
    loadFromJson,
    undo,
    redo,
    markClean,
  } = useDocumentStore();

  async function loadSample() {
    const res = await fetch("/samples/desired-state-sample.json");
    const text = await res.text();
    loadFromJson(text, "desired-state-sample.json");
    setStatus("Loaded sample export");
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadFromJson(String(reader.result), file.name);
        setStatus(`Loaded ${file.name}`);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Failed to load");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function onExport() {
    if (!document) return;
    setExporting(true);
    setStatus("Validating…");
    try {
      const result = await validateDocument(document);
      if (!result.valid) {
        setStatus(
          `Validation failed (${result.errors.length} errors). See JSON view.`,
        );
        return;
      }
      downloadDocument(document, fileName ?? undefined);
      markClean();
      setStatus("Exported (schema valid)");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: 1 }}>
          <Box sx={{ minWidth: 140 }}>
            <Typography
              variant="caption"
              color="primary"
            sx={{ fontWeight: 700, letterSpacing: 1.2, display: "block" }}>
              VSPHERE
            </Typography>
            <Typography variant="subtitle1"
            sx={{ lineHeight: 1.2 }}>
              Desired State
            </Typography>
          </Box>

          <Tabs
            value={navIndex(pathname)}
            textColor="primary"
            indicatorColor="primary"
            sx={{ minHeight: 40, flexGrow: 1 }}
          >
            {NAV.map((item) => (
              <Tab
                key={item.href}
                label={
                  item.href === "/diff" && dirty
                    ? `${item.label}*`
                    : item.label
                }
                component={Link}
                href={item.href}
                sx={{
                  minHeight: 40,
                  py: 0,
                  color: item.href === "/diff" && dirty ? "warning.main" : undefined,
                }}
              />
            ))}
          </Tabs>

          <Stack direction="row" spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={onFileChange}
            />
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => fileRef.current?.click()}
            >
              Import
            </Button>
            <Button
              variant="outlined"
              startIcon={<DataObjectIcon />}
              onClick={loadSample}
            >
              Sample
            </Button>
            <IconButton
              size="small"
              disabled={!history.length}
              onClick={undo}
              aria-label="Undo"
            >
              <UndoIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              disabled={!future.length}
              onClick={redo}
              aria-label="Redo"
            >
              <RedoIcon fontSize="small" />
            </IconButton>
            <ColorModeToggle />
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              disabled={!document || exporting}
              onClick={onExport}
            >
              Export
            </Button>
          </Stack>
        </Toolbar>
        <Box
          sx={{
            px: 3,
            pb: 1.5,
            display: "flex",
            gap: 1.5,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {document ? (
              <>
                {fileName ?? "untitled"}
                {dirty ? (
                  <>
                    {" • "}
                    <Box
                      component={Link}
                      href="/diff"
                      sx={{
                        color: "warning.main",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                    >
                      unsaved
                    </Box>
                  </>
                ) : null}
              </>
            ) : (
              "No document loaded"
            )}
          </Typography>
          {status && (
            <Chip size="small" color="info" variant="outlined" label={status} />
          )}
        </Box>
      </AppBar>

      <Container maxWidth={false} sx={{ maxWidth: 1600, py: 3, px: { xs: 2, sm: 3 } }}>
        {children}
      </Container>
    </Box>
  );
}