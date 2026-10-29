import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { CalibrationView } from './components/CalibrationView';
import { GridView } from './components/GridView';
import { GuideDialog } from './components/GuideDialog';
import { MemberDialog } from './components/MemberDialog';
import { ExportDialog } from './components/ExportDialog';
import { SettingsView } from './components/SettingsView';
import { TeamView } from './components/TeamView';
import { downloadBlob, fileBaseName } from './io/download';
import { draftEnabled, loadDraft, saveDraft, setDraftEnabled } from './io/draft';
import type { PdfOptions } from './io/pdfExport';
import { reducer, type Action } from './model/store';
import type { Workspace } from './model/types';
import { createWorkspace, parseWorkspace, serializeWorkspace } from './model/workspace';

const TABS = [
  { id: 'team', label: 'Team' },
  { id: 'grid', label: 'Grid' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function initialWorkspace(): Workspace {
  return (draftEnabled() && loadDraft()) || createWorkspace();
}

export function App() {
  const [ws, dispatch] = useReducer(reducer, undefined, initialWorkspace);
  const [tab, setTab] = useState<TabId>(() => (ws.members.length ? 'grid' : 'team'));
  const [dirty, setDirty] = useState(false);
  const [keepDraft, setKeepDraft] = useState(draftEnabled);
  const [editing, setEditing] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const act = useCallback((action: Action) => {
    dispatch(action);
    setDirty(true);
  }, []);

  const notify = (text: string, error = false) => setMessage({ text, error });

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), message.error ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (keepDraft) saveDraft(ws);
  }, [ws, keepDraft]);

  useEffect(() => {
    if (!dirty || keepDraft) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, keepDraft]);

  const replace = (next: Workspace) => {
    dispatch({ type: 'replace', workspace: next });
    setDirty(false);
    setEditing(null);
  };

  const confirmDiscard = () =>
    !dirty || confirm('You have changes that are not saved in a file. Continue and lose them?');

  const baseName = fileBaseName(ws.team.name, ws.team.period);

  const save = () => {
    downloadBlob(new Blob([serializeWorkspace(ws)], { type: 'application/json' }), `${baseName}.json`);
    setDirty(false);
    notify('Saved to your downloads. Use “Open” to continue from this file later.');
  };

  const exportToExcel = async () => {
    try {
      const { exportExcel } = await import('./io/excelExport');
      downloadBlob(await exportExcel(ws), `${baseName}.xlsx`);
      setDirty(false);
      notify('Excel file downloaded. It can also be opened here again.');
    } catch (e) {
      notify(`Export failed: ${(e as Error).message}`, true);
    }
  };

  const exportToPdf = async (options: PdfOptions) => {
    try {
      const { exportPdf } = await import('./io/pdfExport');
      downloadBlob(await exportPdf(ws, options), `${baseName}.pdf`);
      notify('PDF downloaded.');
    } catch (e) {
      notify(`Export failed: ${(e as Error).message}`, true);
    }
  };

  const openFile = async (file: File) => {
    try {
      if (/\.json$/i.test(file.name)) {
        const next = parseWorkspace(await file.text());
        if (!confirmDiscard()) return;
        replace(next);
        setTab(next.members.length ? 'grid' : 'team');
        notify(`Opened ${file.name}.`);
        return;
      }
      const { readExcel } = await import('./io/excelImport');
      const result = await readExcel(await file.arrayBuffer(), ws.settings);
      if (result.kind === 'workspace') {
        if (!confirmDiscard()) return;
        replace(result.workspace);
        setTab(result.workspace.members.length ? 'grid' : 'team');
        notify(`Opened ${file.name}.`);
      } else if (result.members.length === 0) {
        notify(`No names found in ${file.name}.`, true);
      } else {
        const placed = result.members.filter((m) => m.savoirEtre && m.savoirFaire).length;
        const question = `Add ${result.members.length} people from the sheet “${result.sheet}” to your team?${
          placed ? `\n\n${placed} of them already have both levels and will be placed in the grid.` : ''
        }`;
        if (!confirm(question)) return;
        act({ type: 'addMembers', members: result.members });
        notify(`Added ${result.members.length} people from ${file.name}.`);
      }
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const newReview = () => {
    if (!confirmDiscard()) return;
    // Tiers, boxes and scales are usually the same for every team, so they carry over.
    replace({ ...createWorkspace(), settings: ws.settings });
    setTab('team');
  };

  const toggleDraft = (enabled: boolean) => {
    setDraftEnabled(enabled);
    setKeepDraft(enabled);
    if (enabled) saveDraft(ws);
  };

  const editingMember = ws.members.find((m) => m.id === editing) ?? null;
  const pickFile = () => fileInput.current?.click();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="logo" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <div>
            <h1>Nine-Box</h1>
            <p>{[ws.team.name || 'Untitled team', ws.team.period].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="topbar__actions">
          {dirty && <span className="pill">Not saved to a file</span>}
          <button type="button" className="button button--on-dark" onClick={newReview}>
            New
          </button>
          <button type="button" className="button button--on-dark" onClick={pickFile}>
            Open…
          </button>
          <button type="button" className="button button--on-dark" onClick={save}>
            Save
          </button>
          <button type="button" className="button button--accent" onClick={() => setExportOpen(true)}>
            Export
          </button>
          <button type="button" className="button button--on-dark" onClick={() => setGuideOpen(true)}>
            Guide
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void openFile(file);
            }}
          />
        </div>
      </header>

      <div className="privacy">
        <span>
          🔒 Private: everything stays in this browser. Use <strong>Save</strong> or <strong>Export</strong> to Excel to
          keep your work.
        </span>
        <label className="privacy__toggle">
          <input type="checkbox" checked={keepDraft} onChange={(e) => toggleDraft(e.target.checked)} />
          Keep a draft in this browser
        </label>
      </div>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' tab--active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'team' && ws.members.length > 0 && <span className="tab__count">{ws.members.length}</span>}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'team' && <TeamView ws={ws} act={act} onEdit={setEditing} onImport={pickFile} />}
        {tab === 'grid' && <GridView ws={ws} act={act} onEdit={setEditing} />}
        {tab === 'calibration' && <CalibrationView ws={ws} act={act} onEdit={setEditing} />}
        {tab === 'settings' && <SettingsView ws={ws} act={act} />}
      </main>

      <footer className="app-footer">Developed by Salman Muddhoo using AI</footer>

      {exportOpen && <ExportDialog onExcel={exportToExcel} onPdf={exportToPdf} onClose={() => setExportOpen(false)} />}

      {guideOpen && <GuideDialog settings={ws.settings} onClose={() => setGuideOpen(false)} />}

      {editingMember && (
        <MemberDialog key={editingMember.id} member={editingMember} settings={ws.settings} act={act} onClose={() => setEditing(null)} />
      )}

      {message && (
        <div className={`toast${message.error ? ' toast--error' : ''}`} role={message.error ? 'alert' : 'status'}>
          {message.text}
          <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setMessage(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
