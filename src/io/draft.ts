import type { Workspace } from '../model/types';
import { parseWorkspace, serializeWorkspace } from '../model/workspace';

// Opt-in only: a copy of the review in this browser's local storage, so a
// refresh does not lose work. It never leaves the device.
const DRAFT_KEY = 'nine-box:draft';
const ENABLED_KEY = 'nine-box:keep-draft';

export function draftEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDraftEnabled(enabled: boolean) {
  try {
    if (enabled) {
      localStorage.setItem(ENABLED_KEY, '1');
    } else {
      localStorage.removeItem(ENABLED_KEY);
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // Storage blocked (private window, policy): the toggle simply has no effect.
  }
}

export function loadDraft(): Workspace | null {
  try {
    const text = localStorage.getItem(DRAFT_KEY);
    return text ? parseWorkspace(text) : null;
  } catch {
    return null;
  }
}

export function saveDraft(ws: Workspace) {
  try {
    localStorage.setItem(DRAFT_KEY, serializeWorkspace(ws));
  } catch {
    // Ignore: quota or blocked storage.
  }
}
