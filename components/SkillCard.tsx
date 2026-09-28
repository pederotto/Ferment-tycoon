import React from 'react';

/* One card for every track on the 1-15 scale (services/skills.ts): the level,
   how far to the next, and what the level buys right now. Printed on paper
   wherever it appears, like the rest of a menu. */
export const SkillCard: React.FC<{
  title: string;
  level: number;
  into: number;
  span: number;
  max: boolean;
  perks: [string, string][];
  note?: string;
}> = ({ title, level, into, span, max, perks, note }) => (
  <section className="el-sect skill-card">
    <h3>{title} <span className="sub">level {level} of 15{max ? ', the most there is' : ''}</span></h3>
    {!max && (
      <div className="fe-bar" title={`${into} of ${span} experience to level ${level + 1}`}>
        <i style={{ width: `${Math.round((into / Math.max(1, span)) * 100)}%` }} />
        <span className="mono">{into} / {span} to level {level + 1}</span>
      </div>
    )}
    <p className="el-kv">{perks.map(([v, l]) => <span key={l}><b>{v}</b> {l}</span>)}</p>
    {note && <p className="el-note">{note}</p>}
  </section>
);

export default SkillCard;
