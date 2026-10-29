import { useEffect, useRef, useState } from 'react';
import type { PdfOptions } from '../io/pdfExport';

type Format = 'excel' | 'pdf';

export function ExportDialog({
  onExcel,
  onPdf,
  onClose,
}: {
  onExcel: () => Promise<void>;
  onPdf: (options: PdfOptions) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<Format>('excel');
  const [calibration, setCalibration] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const option = (value: Format, title: string, description: string) => (
    <label className={`format${format === value ? ' format--on' : ''}`}>
      <input type="radio" name="export-format" value={value} checked={format === value} onChange={() => setFormat(value)} />
      <span>
        <strong>{title}</strong>
        <span className="hint">{description}</span>
      </span>
    </label>
  );

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
          await (format === 'excel' ? onExcel() : onPdf({ calibration }));
          setBusy(false);
          ref.current?.close();
        }}
      >
        <header className="dialog__header">
          <h2>Export</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => ref.current?.close()}>
            ✕
          </button>
        </header>
        <fieldset className="formats">
          <legend className="hint">Choose a format</legend>
          {option('excel', 'Excel (.xlsx)', 'Team list, grid and calibration. It can be opened here again to carry on.')}
          {option('pdf', 'PDF report', 'Team tree with each person’s tier, the grid and calibration. Ready to print or share.')}
        </fieldset>
        {format === 'pdf' && (
          <div className="checks">
            <label>
              <input type="checkbox" checked={calibration} onChange={() => setCalibration((c) => !c)} />
              Include the calibration and increments page
            </label>
          </div>
        )}
        <footer className="dialog__footer">
          <button type="button" className="button button--ghost" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Preparing…' : format === 'excel' ? 'Download Excel' : 'Download PDF'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
