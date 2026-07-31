"use client";

import { create } from "zustand";
import type { DesiredStateDocument } from "@/lib/desired-state/types";
import { isDesiredStateDocument } from "@/lib/desired-state/validate";
import { listHostIds } from "@/lib/desired-state/resolve";

const MAX_HISTORY = 50;

interface DocumentState {
  document: DesiredStateDocument | null;
  /** Snapshot from load / last successful export — Diff page compares against this. */
  baseline: DesiredStateDocument | null;
  fileName: string | null;
  selectedHostIds: string[];
  history: DesiredStateDocument[];
  future: DesiredStateDocument[];
  dirty: boolean;

  loadDocument: (doc: DesiredStateDocument, fileName?: string) => void;
  loadFromJson: (text: string, fileName?: string) => void;
  setDocument: (doc: DesiredStateDocument) => void;
  updateDocument: (updater: (doc: DesiredStateDocument) => DesiredStateDocument) => void;
  setSelectedHostIds: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  markClean: () => void;
}

function pushHistory(
  history: DesiredStateDocument[],
  doc: DesiredStateDocument,
): DesiredStateDocument[] {
  const next = [...history, structuredClone(doc)];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: null,
  baseline: null,
  fileName: null,
  selectedHostIds: [],
  history: [],
  future: [],
  dirty: false,

  loadDocument: (doc, fileName) => {
    const hostIds = listHostIds(doc).slice(0, 4);
    const snapshot = structuredClone(doc);
    set({
      document: snapshot,
      baseline: structuredClone(doc),
      fileName: fileName ?? "desired-state.json",
      selectedHostIds: hostIds.length >= 2 ? hostIds : hostIds,
      history: [],
      future: [],
      dirty: false,
    });
  },

  loadFromJson: (text, fileName) => {
    const parsed = JSON.parse(text) as unknown;
    if (!isDesiredStateDocument(parsed)) {
      throw new Error('Invalid Desired State JSON: missing "profile"');
    }
    get().loadDocument(parsed, fileName);
  },

  setDocument: (doc) => {
    const { document } = get();
    set({
      document: structuredClone(doc),
      history: document ? pushHistory(get().history, document) : get().history,
      future: [],
      dirty: true,
    });
  },

  updateDocument: (updater) => {
    const { document } = get();
    if (!document) return;
    const next = updater(structuredClone(document));
    set({
      document: next,
      history: pushHistory(get().history, document),
      future: [],
      dirty: true,
    });
  },

  setSelectedHostIds: (ids) => {
    const unique = [...new Set(ids)].slice(0, 4);
    set({ selectedHostIds: unique });
  },

  undo: () => {
    const { history, document, future } = get();
    if (!history.length || !document) return;
    const prev = history[history.length - 1];
    set({
      document: prev,
      history: history.slice(0, -1),
      future: [structuredClone(document), ...future],
      dirty: true,
    });
  },

  redo: () => {
    const { future, document, history } = get();
    if (!future.length || !document) return;
    const next = future[0];
    set({
      document: next,
      future: future.slice(1),
      history: pushHistory(history, document),
      dirty: true,
    });
  },

  clear: () =>
    set({
      document: null,
      baseline: null,
      fileName: null,
      selectedHostIds: [],
      history: [],
      future: [],
      dirty: false,
    }),

  markClean: () => {
    const { document } = get();
    set({
      dirty: false,
      baseline: document ? structuredClone(document) : null,
    });
  },
}));

export function downloadDocument(doc: DesiredStateDocument, fileName?: string) {
  const blob = new Blob([JSON.stringify(doc, null, 4)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    fileName ??
    `desired-state-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
