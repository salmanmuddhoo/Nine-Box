import { GUIDING_QUESTIONS } from '../model/defaults';
import type { Action } from '../model/store';
import type { Workspace } from '../model/types';

export function GuideView({ ws, act }: { ws: Workspace; act: (action: Action) => void }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>How to use this tool</h2>
        <ol className="steps">
          <li>
            <strong>Team</strong> — name your team and add the members (type, paste a list, or import from Excel).
          </li>
          <li>
            <strong>Settings</strong> — check the tiers, their target share and the default increment %, and which tier
            each box feeds.
          </li>
          <li>
            <strong>Grid</strong> — drag each person into a box, or pick their {ws.settings.savoirEtre.name} and{' '}
            {ws.settings.savoirFaire.name} levels on the Team tab.
          </li>
          <li>
            <strong>Calibration</strong> — compare the distribution with the targets and move people between tiers where
            needed. The increment budget updates as you go.
          </li>
          <li>
            <strong>Save</strong> the file or <strong>Export Excel</strong> before closing the tab. Both files can be
            opened again here later. <strong>Export PDF</strong> gives a report to print or share.
          </li>
        </ol>
        <p className="notice">
          <strong>Confidential.</strong> This review holds sensitive information about your team. Nothing leaves this
          browser: there is no server and no database. Keep the saved files somewhere only the relevant people can read
          them.
        </p>
      </section>

      <section className="card">
        <h2>Guiding questions</h2>
        <p className="hint">Use these to frame the review. Your notes are kept in the saved file and in the Excel export.</p>
        <div className="questions">
          {GUIDING_QUESTIONS.map((q) => (
            <div key={q.id} className="question">
              <h3>{q.title}</h3>
              <p>{q.question}</p>
              <textarea
                aria-label={`Notes: ${q.title}`}
                rows={3}
                placeholder="Your notes"
                value={ws.notes[q.id] ?? ''}
                onChange={(e) => act({ type: 'note', id: q.id, text: e.target.value })}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
