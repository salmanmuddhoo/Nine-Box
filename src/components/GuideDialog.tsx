import { useEffect, useRef } from 'react';
import { GUIDING_QUESTIONS } from '../model/defaults';
import type { Settings } from '../model/types';

export function GuideDialog({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog dialog--wide"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <form method="dialog" className="dialog__body">
        <header className="dialog__header">
          <h2>Guide</h2>
          <button type="submit" className="icon-button" aria-label="Close">
            ✕
          </button>
        </header>

        <section className="guide-section">
          <h3>How to use this tool</h3>
          <ol className="steps">
            <li>
              <strong>Team</strong> — name your team and add the members (type, paste a list, or import from Excel).
            </li>
            <li>
              <strong>Settings</strong> — check the tiers, their target share and the default increment %, and which tier
              each box feeds.
            </li>
            <li>
              <strong>Grid</strong> — drag each person into a box, or click a name to choose their {settings.savoirEtre.name} and{' '}
              {settings.savoirFaire.name} levels.
            </li>
            <li>
              <strong>Calibration</strong> — compare the distribution with the targets and move people between tiers where
              needed. Increments follow the tier.
            </li>
            <li>
              <strong>Save</strong> the file or <strong>Export Excel</strong> before closing the tab. Both files can be
              opened again here later. <strong>Export PDF</strong> gives a report to print or share.
            </li>
          </ol>
          <p className="notice">
            <strong>Confidential.</strong> This review holds sensitive information about your team. Everything stays in
            this browser; keep the saved files somewhere only the relevant people can read them.
          </p>
        </section>

        <section className="guide-section">
          <h3>Guiding questions</h3>
          <p className="hint">Use these to frame the review.</p>
          <dl className="questions">
            {GUIDING_QUESTIONS.map((q) => (
              <div key={q.id} className="question">
                <dt>{q.title}</dt>
                <dd>{q.question}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="dialog__footer dialog__footer--end">
          <button type="submit" className="button button--primary">
            Close
          </button>
        </footer>
      </form>
    </dialog>
  );
}
