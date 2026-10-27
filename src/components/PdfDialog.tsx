import { useEffect, useRef, useState } from 'react';
import type { PdfOptions } from '../io/pdfExport';
import type { Workspace } from '../model/types';

export function PdfDialog({
  ws,
  onExport,
  onClose,
}: {
  ws: Workspace;
  onExport: (options: PdfOptions) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<PdfOptions>(() => ({ calibration: true, team: ws.members.length > 0 }));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const toggle = (key: keyof PdfOptions) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current && !busy) ref.current.close();
      }}
    >
      <form
        method="dialog"
        className="dialog__body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onExport(options);
          setBusy(false);
          ref.current?.close();
        }}
      >
        <header className="dialog__header">
          <h2>Export PDF</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => ref.current?.close()}>
            ✕
          </button>
        </header>
        <p className="hint">A landscape A4 report, ready to print or share. Choose what goes in it.</p>
        <div className="checks">
          <label>
            <input type="checkbox" checked disabled />
            Nine-Box grid
          </label>
          <label>
            <input type="checkbox" checked={options.calibration} onChange={() => toggle('calibration')} />
            Calibration and increments
          </label>
          <label>
            <input type="checkbox" checked={options.team} disabled={ws.members.length === 0} onChange={() => toggle('team')} />
            Team list
          </label>
        </div>
        <footer className="dialog__footer">
          <button type="button" className="button button--ghost" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Preparing…' : 'Download PDF'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
