"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useColorScheme, useTheme } from "@mui/material/styles";
import type { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  isDesiredStateDocument,
  validateDocument,
} from "@/lib/desired-state/validate";
import {
  locateJsonPointer,
  pointerFromValidationError,
} from "@/lib/json-pointer-locate";
import { useDocumentStore } from "@/lib/store";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function JsonEditorView() {
  const { document, loadFromJson, fileName } = useDocumentStore();
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (document) {
      setText(JSON.stringify(document, null, 2));
      setErrors([]);
    }
  }, [document]);

  const resolvedMode =
    mounted && mode ? (mode === "system" ? systemMode : mode) : theme.palette.mode;
  const monacoTheme = resolvedMode === "dark" ? "vs-dark" : "light";

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  function jumpToError(error: string) {
    const pointer = pointerFromValidationError(error);
    if (!pointer) return;

    const location = locateJsonPointer(textRef.current, pointer);
    const editor = editorRef.current;
    if (!location || !editor) {
      setInfo(
        location
          ? "Editor not ready"
          : `Could not locate ${pointer} in the JSON text`,
      );
      return;
    }

    editor.revealLineInCenter(location.line);
    editor.setPosition({ lineNumber: location.line, column: location.column });
    editor.setSelection({
      startLineNumber: location.line,
      startColumn: location.column,
      endLineNumber: location.line,
      endColumn: location.column + location.length,
    });
    editor.focus();
  }

  async function applyEditor() {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!isDesiredStateDocument(parsed)) {
        setErrors(['Missing required "profile" object']);
        return;
      }
      loadFromJson(text, fileName ?? "edited.json");
      setInfo("Applied editor contents to document store");
      setErrors([]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Invalid JSON"]);
    }
  }

  async function runValidate() {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!isDesiredStateDocument(parsed)) {
        setErrors(['Missing required "profile" object']);
        return;
      }
      const result = await validateDocument(parsed);
      if (result.valid) {
        setErrors([]);
        setInfo("Schema validation passed");
      } else {
        setErrors(result.errors.slice(0, 50));
        setInfo(null);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Validation failed"]);
    }
  }

  if (!document) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          Load a document to edit raw JSON.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={applyEditor}>
          Apply to document
        </Button>
        <Button variant="outlined" onClick={runValidate}>
          Validate against schema
        </Button>
      </Stack>

      {info && (
        <Alert severity="success" onClose={() => setInfo(null)}>
          {info}
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert severity="error">
          <Typography variant="body2" sx={{ mb: 1 }}>
            Click an error to jump to that location in the editor.
          </Typography>
          <List dense disablePadding sx={{ maxHeight: 200, overflow: "auto" }}>
            {errors.map((e) => (
              <ListItem key={e} disablePadding>
                <ListItemButton
                  onClick={() => jumpToError(e)}
                  sx={{ borderRadius: 1, py: 0.25 }}
                >
                  <ListItemText
                    primary={
                      <Link
                        component="button"
                        type="button"
                        variant="body2"
                        underline="hover"
                        color="inherit"
                        sx={{
                          textAlign: "left",
                          fontFamily: "var(--font-geist-mono), monospace",
                          fontSize: "0.8rem",
                        }}
                      >
                        {e}
                      </Link>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Monaco
          height="70vh"
          language="json"
          theme={monacoTheme}
          value={text}
          onChange={(v) => setText(v ?? "")}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </Paper>
    </Stack>
  );
}