import { formatCount, formatMoney, formatPercent } from '../format';
import { calibration, incrementSummary, isTierAdjusted, memberBox, memberIncrement, memberTier } from '../model/logic';
import type { Action } from '../model/store';
import type { Workspace } from '../model/types';
import { TierSelect } from './fields';
import { tierStyle, TierBadge } from './TierBadge';

export function CalibrationView({ ws, act, onEdit }: { ws: Workspace; act: (action: Action) => void; onEdit: (memberId: string) => void }) {
  const { settings } = ws;
  const cal = calibration(ws);
  const inc = incrementSummary(ws);
  const missingSalary = ws.members.filter((m) => m.salary === null).length;
  const missingIncrement = ws.members.filter((m) => memberTier(settings, m) && memberIncrement(settings, m) === null).length;

  return (
    <div className="stack">
      <section className="card">
        <div className="card__title-row">
          <h2>Distribution against targets</h2>
          <span className="muted">
            {cal.placed} of {cal.total} placed
          </span>
        </div>
        {Math.abs(cal.targetSum - 100) > 0.001 && (
          <p className="warning">Tier targets add up to {formatPercent(cal.targetSum)} instead of 100 %. Adjust them in Settings.</p>
        )}
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Tier</th>
                <th className="num">Target</th>
                <th className="num">Target headcount</th>
                <th className="num">Actual</th>
                <th className="num">Actual %</th>
                <th>Gap</th>
                <th className="bar-col" aria-label="Chart" />
              </tr>
            </thead>
            <tbody>
              {cal.rows.map((row) => {
                const diff = row.count - row.targetCount;
                const status = cal.total === 0 || Math.abs(diff) < 1 ? 'ok' : diff > 0 ? 'over' : 'under';
                return (
                  <tr key={row.tier.id} style={tierStyle(row.tier)}>
                    <td>
                      <TierBadge tier={row.tier} />
                    </td>
                    <td className="num">{formatPercent(row.tier.target)}</td>
                    <td className="num">{formatCount(row.targetCount)}</td>
                    <td className="num">
                      <strong>{row.count}</strong>
                    </td>
                    <td className="num">{formatPercent(row.percent)}</td>
                    <td>
                      <span className={`gap gap--${status}`}>
                        {status === 'ok' ? 'On target' : `${diff > 0 ? '+' : '−'}${formatCount(Math.abs(diff))} ${status === 'over' ? 'over' : 'under'}`}
                      </span>
                    </td>
                    <td className="bar-col">
                      <span className="bar" aria-hidden>
                        <span style={{ width: `${Math.min(100, row.percent)}%` }} />
                        <i style={{ left: `${Math.min(100, row.tier.target)}%` }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {cal.unplaced > 0 && (
                <tr>
                  <td>
                    <TierBadge tier={null} />
                  </td>
                  <td />
                  <td />
                  <td className="num">
                    <strong>{cal.unplaced}</strong>
                  </td>
                  <td className="num">{formatPercent((cal.unplaced / cal.total) * 100)}</td>
                  <td colSpan={2} className="muted">
                    Place everyone before finalising.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Targets are counted on the whole team ({cal.total} people). “On target” means within one person of the target
          headcount.
        </p>
      </section>

      <section className="card">
        <h2>Calibrate</h2>
        <p className="hint">
          Move people between tiers without changing their box, for example to split a crowded box across two tiers to
          meet the targets. Pick “Auto” to go back to the box's tier.
        </p>
        <div className="tier-columns">
          {settings.tiers.map((tier) => {
            const members = ws.members.filter((m) => memberTier(settings, m)?.id === tier.id);
            return (
              <div key={tier.id} className="tier-column" style={tierStyle(tier)}>
                <h3>
                  {tier.name} <span className="muted">({members.length})</span>
                </h3>
                {members.length === 0 ? (
                  <p className="muted">Nobody yet.</p>
                ) : (
                  <ul>
                    {members.map((m) => {
                      const box = memberBox(m);
                      return (
                        <li key={m.id}>
                          <button type="button" className="link" onClick={() => onEdit(m.id)}>
                            {m.name || 'Unnamed'}
                          </button>
                          <span className="muted small">
                            {box ? settings.boxes[box].title : ''}
                            {isTierAdjusted(settings, m) ? ' · adjusted' : ''}
                          </span>
                          <TierSelect
                            settings={settings}
                            member={m}
                            onChange={(v) => act({ type: 'updateMember', id: m.id, patch: { tierOverride: v } })}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Annual increments</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Tier</th>
                <th className="num">Members</th>
                <th className="num">Default increment</th>
                <th className="num">Current payroll</th>
                <th className="num">Increment cost</th>
                <th className="num">% of payroll</th>
              </tr>
            </thead>
            <tbody>
              {inc.rows.map((row) =>
                row.tier === null && row.count === 0 ? null : (
                  <tr key={row.tier?.id ?? 'none'}>
                    <td>
                      <TierBadge tier={row.tier} />
                    </td>
                    <td className="num">{row.count}</td>
                    <td className="num">{row.tier ? formatPercent(row.tier.increment) || <span className="muted">not set</span> : ''}</td>
                    <td className="num">{formatMoney(row.payroll, settings.currency)}</td>
                    <td className="num">{formatMoney(row.increment, settings.currency)}</td>
                    <td className="num">{row.payroll ? formatPercent((row.increment / row.payroll) * 100) : ''}</td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <td className="num">{inc.total.count}</td>
                <td />
                <td className="num">{formatMoney(inc.total.payroll, settings.currency)}</td>
                <td className="num">
                  <strong>{formatMoney(inc.total.increment, settings.currency)}</strong>
                </td>
                <td className="num">{inc.total.payroll ? formatPercent((inc.total.increment / inc.total.payroll) * 100) : ''}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {(missingSalary > 0 || missingIncrement > 0) && (
          <p className="hint">
            {missingSalary > 0 && `${missingSalary} member${missingSalary > 1 ? 's have' : ' has'} no salary entered. `}
            {missingIncrement > 0 &&
              `${missingIncrement} placed member${missingIncrement > 1 ? 's have' : ' has'} no increment % yet — set one per tier in Settings or per person on the Team tab.`}
          </p>
        )}
      </section>
    </div>
  );
}
