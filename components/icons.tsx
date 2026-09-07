import React from 'react';
import { IngredientType, StaffRoleType, BuyerType, Ingredient } from '../types';

/**
 * Shared SVG icon library — ported 1:1 from the approved "Warm Artisan
 * Workshop" mockups (Welcome.dc.html, Main.dc.html, Inspector.dc.html,
 * Market.dc.html, Workshop.dc.html, Staff.dc.html) so every screen in the
 * real app draws from one visual vocabulary instead of duplicating inline
 * SVG per-component.
 *
 * Every icon is a plain functional component: `size` sets width/height
 * (default 16), `color` sets the stroke/fill (each icon defaults to the
 * color it used in its mockup), and `className`/`style` pass through.
 */

export interface IconProps {
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/* =========================================================================
   BRAND / CHROME
   ========================================================================= */

// The fermentation-vessel glyph inside the HUD seal and the Welcome seal.
export const SealGlyphIcon: React.FC<IconProps> = ({ size = 22, color = '#e7c77b', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M9 3h6M10 3v5.2L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.2V3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.5 14.5c1.2 1 2 1 3 .3s1.9-.7 3 0 1.9.7 3 .1" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Almanac / weather compass icon (HUD date block).
export const AlmanacIcon: React.FC<IconProps> = ({ size = 18, color = '#c8935a', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// Wrench/tool glyph — Hardware tab, "The Lab" welcome line, Workshop header.
export const WrenchIcon: React.FC<IconProps> = ({ size = 14, color = '#c8935a', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M14.7 3.3a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-2 2-6-6zM3 21l4.2-1 9-9-3.2-3.2-9 9z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

// Two-person roster glyph — Staff tab, Staff ledger header.
export const StaffGroupIcon: React.FC<IconProps> = ({ size = 14, color = '#9d8bb0', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.3" />
    <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke={color} strokeWidth="1.3" />
    <circle cx="17" cy="9" r="2.4" stroke={color} strokeWidth="1.3" />
    <path d="M15.5 20c.2-2.2 1.7-3.8 3.8-4.2" stroke={color} strokeWidth="1.3" />
  </svg>
);

// Book glyph — Codex tab.
export const BookIcon: React.FC<IconProps> = ({ size = 14, color = '#8a9a6b', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M5 4.5C5 3.7 5.7 3 6.5 3H18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6.5c-.8 0-1.5-.7-1.5-1.5z" stroke={color} strokeWidth="1.3" />
    <path d="M5 17.5c0-.8.7-1.5 1.5-1.5H19" stroke={color} strokeWidth="1.3" />
  </svg>
);

// Shopping-bag glyph — Marketplace header.
export const BagIcon: React.FC<IconProps> = ({ size = 18, color = '#c8935a', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M4 8l1.5-4h13L20 8M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M4 8h16M9 12a3 3 0 0 0 6 0" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

// Shield glyph — "Underground Channel" toggle, Underground buyer badge.
export const ShieldIcon: React.FC<IconProps> = ({ size = 12, color = '#f3ded4', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M12 2 3 6v6c0 5 4 9 9 10 5-1 9-5 9-10V6z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

// Bolt glyph — power/grid tickets.
export const BoltIcon: React.FC<IconProps> = ({ size = 14, color = 'var(--amber)', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

// Battery/circuit glyph — "Power Infrastructure" column header.
export const BatteryIcon: React.FC<IconProps> = ({ size = 13, color = '#8a7c65', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="6" y="2" width="12" height="20" rx="2" stroke={color} strokeWidth="1.3" />
    <path d="M9 7h6M9 11h6" stroke={color} strokeWidth="1.3" />
  </svg>
);

// Jar-outline glyph (simple line icon) — Workshop "Fermentation Vessels" column header.
export const JarOutlineIcon: React.FC<IconProps> = ({ size = 13, color = '#8a7c65', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M5 4.5C5 3.7 5.7 3 6.5 3H18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6.5c-.8 0-1.5-.7-1.5-1.5z" stroke={color} strokeWidth="1.3" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M5 5l14 14M19 5L5 19" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, color = '#8a7c65', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 13, color = '#8a7c65', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth="1.4" />
    <path d="M20 20l-4-4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size = 16, color = '#9d8bb0', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.4" />
    <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 16, color = '#c8935a', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.4" />
    <path d="M12 8v4l3 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 16, color = '#1d1206', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LogLinesIcon: React.FC<IconProps> = ({ size = 11, color = 'var(--text-lo)', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M4 6h16M4 12h16M4 18h10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/* =========================================================================
   GAUGE RING — parametric arc used by HUD gauges + Inspector dials
   ========================================================================= */

interface GaugeRingProps {
  /** 0-100 */
  percent: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

// A ~200-degree arc gauge (matches the HUD's power/hygiene/heat rings and the
// Inspector's small telemetry dials — both trace the same "a19 23a19 0 0 1 38 0"-
// style arc, just at different sizes).
export const GaugeRing: React.FC<GaugeRingProps> = ({ percent, color, size = 46, strokeWidth = 5 }) => {
  const clamped = Math.max(0, Math.min(100, percent));
  // The arc mockups used had a total path length of ~59.6 (46px rings) / ~72 (54px dials).
  // We compute a matching semicircle path for any size so the icon stays crisp at
  // both the HUD's 46px rings and the Inspector's 54x30 dial rings.
  const w = size;
  const h = size * (30 / 46);
  const r = (w - strokeWidth * 2) / 2 + strokeWidth / 2;
  const cx = w / 2;
  const cy = h;
  const start = { x: cx - r, y: cy };
  const end = { x: cx + r, y: cy };
  const path = `M${start.x} ${start.y} A${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  // Approximate arc length for a semicircle: pi * r
  const arcLen = Math.PI * r;
  const dashOffset = arcLen * (1 - clamped / 100);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke="rgba(243,233,216,0.12)" strokeWidth={strokeWidth} />
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={arcLen} strokeDashoffset={dashOffset} />
    </svg>
  );
};

/* =========================================================================
   VESSEL ART — the detailed painted SVGs used on bench cubbies + inspector
   ========================================================================= */

let __idSeed = 0;
function uid(prefix: string) {
  __idSeed += 1;
  return `${prefix}${__idSeed}`;
}

export const JarVesselArt: React.FC<IconProps> = ({ size = 140, className, style }) => {
  const clip = uid('jarclip');
  const grad = uid('brine');
  const h = typeof size === 'number' ? size * (187 / 140) : size;
  return (
    <svg width={size} height={h} viewBox="0 0 120 160" className={className} style={style}>
      <defs>
        <clipPath id={clip}><path d="M35 22 h50 v9 q0 6 6 8 q10 4 10 17 v78 q0 14 -14 14 h-54 q-14 0 -14 -14 v-78 q0 -13 10 -17 q6 -2 6 -8 z" /></clipPath>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7be6b" /><stop offset="100%" stopColor="#a9721f" />
        </linearGradient>
      </defs>
      <path d="M35 22 h50 v9 q0 6 6 8 q10 4 10 17 v78 q0 14 -14 14 h-54 q-14 0 -14 -14 v-78 q0 -13 10 -17 q6 -2 6 -8 z" fill="rgba(243,233,216,0.07)" stroke="rgba(243,233,216,0.4)" strokeWidth="2" />
      <g clipPath={`url(#${clip})`}>
        <rect x="18" y="72" width="84" height="80" fill={`url(#${grad})`} />
        <ellipse cx="60" cy="72" rx="42" ry="6" fill="#f2d38f" />
        <circle cx="46" cy="95" r="8" fill="#c98a2c" opacity="0.5" />
        <circle cx="72" cy="110" r="6" fill="#c98a2c" opacity="0.5" />
      </g>
      <rect x="37" y="12" width="46" height="15" rx="3" fill="#8a6a3a" stroke="#5f4322" strokeWidth="1.5" />
    </svg>
  );
};

export const TrayVesselArt: React.FC<IconProps> = ({ size = 168, className, style }) => {
  const grad = uid('traywood');
  const h = typeof size === 'number' ? size * (138 / 168) : size;
  return (
    <svg width={size} height={h} viewBox="0 0 160 120" className={className} style={style}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4a29" /><stop offset="100%" stopColor="#4a3018" />
        </linearGradient>
      </defs>
      <rect x="8" y="46" width="144" height="46" rx="6" fill={`url(#${grad})`} stroke="rgba(243,233,216,0.3)" strokeWidth="2" />
      <rect x="8" y="46" width="144" height="10" rx="4" fill="rgba(243,233,216,0.12)" />
      <g opacity="0.85">
        <ellipse cx="38" cy="60" rx="10" ry="6" fill="#eee3cc" />
        <ellipse cx="60" cy="56" rx="8" ry="5" fill="#e3d6b8" />
        <ellipse cx="84" cy="62" rx="11" ry="6" fill="#f2e8d2" />
        <ellipse cx="110" cy="57" rx="9" ry="5" fill="#e3d6b8" />
        <ellipse cx="130" cy="63" rx="8" ry="5" fill="#eee3cc" />
      </g>
    </svg>
  );
};

export const ThermalChamberArt: React.FC<IconProps> = ({ size = 138, className, style }) => {
  const grad = uid('hotglow');
  const h = typeof size === 'number' ? size * (168 / 138) : size;
  return (
    <svg width={size} height={h} viewBox="0 0 120 140" className={className} style={style}>
      <defs>
        <radialGradient id={grad} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#e8654a" /><stop offset="100%" stopColor="#5c1e12" />
        </radialGradient>
      </defs>
      <rect x="12" y="10" width="96" height="120" rx="8" fill="#241a12" stroke="rgba(243,233,216,0.3)" strokeWidth="2" />
      <rect x="26" y="24" width="68" height="66" rx="5" fill={`url(#${grad})`} opacity="0.9" />
      <circle cx="34" cy="106" r="5" fill="#e7c77b" />
      <circle cx="50" cy="106" r="5" fill="#8a7c65" />
      <rect x="66" y="101" width="30" height="10" rx="2" fill="#8a7c65" />
    </svg>
  );
};

export const OnggiVesselArt: React.FC<IconProps> = ({ size = 132, className, style }) => {
  const grad = uid('clay');
  const h = typeof size === 'number' ? size * (168 / 132) : size;
  return (
    <svg width={size} height={h} viewBox="0 0 110 140" className={className} style={style}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c1793f" /><stop offset="100%" stopColor="#8a4f22" />
        </linearGradient>
      </defs>
      <path d="M40 8h30l4 18c14 6 21 24 21 44 0 34-16 62-40 62s-40-28-40-62c0-20 7-38 21-44z" fill={`url(#${grad})`} stroke="rgba(243,233,216,0.25)" strokeWidth="2" />
      <ellipse cx="55" cy="26" rx="17" ry="5" fill="rgba(0,0,0,0.2)" />
      <path d="M20 78c8 4 20 6 35 6s27-2 35-6" stroke="rgba(0,0,0,0.18)" strokeWidth="2" fill="none" />
    </svg>
  );
};

// Cedar Barrel — extends the mockup's visual language (wood-stave body + iron
// hoops) since the mockups only showed a line-icon for this vessel, not full
// bench art.
export const CedarBarrelArt: React.FC<IconProps> = ({ size = 150, className, style }) => {
  const grad = uid('barrelwood');
  const h = typeof size === 'number' ? size * (168 / 150) : size;
  return (
    <svg width={size} height={h} viewBox="0 0 130 140" className={className} style={style}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5a3a1e" /><stop offset="50%" stopColor="#8a5c30" /><stop offset="100%" stopColor="#4a3018" />
        </linearGradient>
      </defs>
      <path d="M28 14h74l10 55-10 55H28l-10-55z" fill={`url(#${grad})`} stroke="rgba(243,233,216,0.3)" strokeWidth="2" />
      <path d="M22 30h86M18 55h94M18 83h94M22 108h86" stroke="#2a1a0d" strokeWidth="3" opacity="0.55" />
      <path d="M28 14c8 20 8 96 0 110M102 14c-8 20-8 96 0 110" stroke="rgba(0,0,0,0.2)" strokeWidth="2" fill="none" />
    </svg>
  );
};

// Oak Cask — same family as the barrel but slimmer/taller, in a darker oak tone.
export const OakCaskArt: React.FC<IconProps> = ({ size = 140, className, style }) => {
  const grad = uid('caskwood');
  const h = typeof size === 'number' ? size * (172 / 140) : size;
  return (
    <svg width={size} height={h} viewBox="0 0 110 140" className={className} style={style}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3c2716" /><stop offset="50%" stopColor="#6b4527" /><stop offset="100%" stopColor="#2f1e10" />
        </linearGradient>
      </defs>
      <path d="M24 12h62l8 58-8 58H24l-8-58z" fill={`url(#${grad})`} stroke="rgba(243,233,216,0.28)" strokeWidth="2" />
      <path d="M18 28h74M15 55h80M15 85h80M18 112h74" stroke="#1a0f07" strokeWidth="3" opacity="0.6" />
      <circle cx="55" cy="70" r="6" fill="#17110a" stroke="rgba(243,233,216,0.3)" strokeWidth="1.5" />
    </svg>
  );
};

export type VesselId = 'mason_jar' | 'koji_tray' | 'onggi' | 'incubator' | 'cedar_barrel' | 'oak_cask' | string;

/** The detailed painted vessel art used on bench cubbies and the Inspector's centerpiece. */
export const VesselArt: React.FC<IconProps & { vesselId: VesselId }> = ({ vesselId, ...rest }) => {
  switch (vesselId) {
    case 'mason_jar': return <JarVesselArt {...rest} />;
    case 'koji_tray': return <TrayVesselArt {...rest} />;
    case 'onggi': return <OnggiVesselArt {...rest} />;
    case 'incubator': return <ThermalChamberArt {...rest} />;
    case 'cedar_barrel': return <CedarBarrelArt {...rest} />;
    case 'oak_cask': return <OakCaskArt {...rest} />;
    default: return <JarVesselArt {...rest} />;
  }
};

/* ---------- Simple line-icon variants used in Marketplace / Workshop lists ---------- */

export const JarLineIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor', className, style }) => (
  <CheckIcon size={size} color={color} className={className} style={style} />
);

export const OnggiLineIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor', className, style }) => (
  <svg width={size} height={typeof size === 'number' ? size * (17 / 13) : size} viewBox="0 0 24 30" fill="none" className={className} style={style}>
    <path d="M9 3h6l1 4c3 1.3 4.7 5 4.7 9 0 7-3.6 12.5-8.7 12.5S3 23 3 16c0-4 1.7-7.7 4.7-9z" stroke={color} strokeWidth="1.5" />
  </svg>
);

export const ThermalChamberLineIcon: React.FC<IconProps> = ({ size = 15, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="3" y="2" width="18" height="20" rx="2" stroke={color} strokeWidth="1.5" />
    <rect x="7" y="6" width="10" height="9" rx="1" stroke={color} strokeWidth="1.3" />
    <circle cx="8.5" cy="19" r="1.1" fill={color} />
    <circle cx="12.5" cy="19" r="1.1" fill={color} />
  </svg>
);

export const CedarBarrelLineIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={typeof size === 'number' ? size * (26 / 20) : size} viewBox="0 0 20 26" fill="none" className={className} style={style}>
    <path d="M4 3h12l1.5 10L16 23H4L2.5 13z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M2.7 8.5h14.6M2.7 17.5h14.6" stroke={color} strokeWidth="1.1" opacity="0.7" />
  </svg>
);

export const TrayLineIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', className, style }) => (
  <svg width={size} height={typeof size === 'number' ? size * (14 / 18) : size} viewBox="0 0 24 18" fill="none" className={className} style={style}>
    <rect x="1" y="6" width="22" height="8" rx="3" stroke={color} strokeWidth="1.5" />
  </svg>
);

export const OakCaskLineIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={typeof size === 'number' ? size * (26 / 20) : size} viewBox="0 0 20 26" fill="none" className={className} style={style}>
    <path d="M4 3h12l1 10-1 10H4L3 13z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="10" cy="13" r="2" stroke={color} strokeWidth="1" />
  </svg>
);

export const VesselLineIcon: React.FC<IconProps & { vesselId: VesselId }> = ({ vesselId, ...rest }) => {
  switch (vesselId) {
    case 'mason_jar': return <JarLineIcon {...rest} />;
    case 'koji_tray': return <TrayLineIcon {...rest} />;
    case 'onggi': return <OnggiLineIcon {...rest} />;
    case 'incubator': return <ThermalChamberLineIcon {...rest} />;
    case 'cedar_barrel': return <CedarBarrelLineIcon {...rest} />;
    case 'oak_cask': return <OakCaskLineIcon {...rest} />;
    default: return <JarOutlineIcon {...rest} />;
  }
};

/* =========================================================================
   INGREDIENT ICONS
   ========================================================================= */

export const GrainSprigIcon: React.FC<IconProps> = ({ size = 15, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M8 14V3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <ellipse cx="6.3" cy="5" rx="1.6" ry="0.9" transform="rotate(-30 6.3 5)" fill={color} />
    <ellipse cx="9.7" cy="5" rx="1.6" ry="0.9" transform="rotate(30 9.7 5)" fill={color} />
    <ellipse cx="6.3" cy="7.6" rx="1.6" ry="0.9" transform="rotate(-30 6.3 7.6)" fill={color} />
    <ellipse cx="9.7" cy="7.6" rx="1.6" ry="0.9" transform="rotate(30 9.7 7.6)" fill={color} />
    <ellipse cx="6.3" cy="10.2" rx="1.6" ry="0.9" transform="rotate(-30 6.3 10.2)" fill={color} />
    <ellipse cx="9.7" cy="10.2" rx="1.6" ry="0.9" transform="rotate(30 9.7 10.2)" fill={color} />
  </svg>
);

export const SaltCrystalIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M8 2l4 4-4 8-4-8z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M4.3 6h7.4M8 2.3v11.4" stroke={color} strokeWidth="0.8" opacity="0.6" />
  </svg>
);

export const WaterDropIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M8 2s4.5 5.2 4.5 8.2a4.5 4.5 0 0 1-9 0C3.5 7.2 8 2 8 2z" stroke={color} strokeWidth="1.3" />
  </svg>
);

export const SporeClusterIcon: React.FC<IconProps> = ({ size = 15, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <circle cx="8" cy="9.3" r="3" stroke={color} strokeWidth="1.2" />
    <circle cx="4.6" cy="5.4" r="1.2" fill={color} />
    <circle cx="8" cy="4" r="1" fill={color} />
    <circle cx="11.4" cy="5.6" r="1.2" fill={color} />
  </svg>
);

export const FishIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M2 8c2.5-3 8-3.5 11-1.5M2 8c2.5 3 8 3.5 11 1.5M13 6.5c1 .5 1.6 1 1.6 1.5s-.6 1-1.6 1.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="4.4" cy="7.6" r="0.6" fill={color} />
  </svg>
);

export const PepperIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M6 3c1 0 1.4.9 1.2 1.8" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <path d="M7 4.5c2 0 5 2.3 5 5.5 0 2.5-2 4-4 4S3 12.3 3 9.8c0-1.9 1.3-3.4 2.6-4.4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const LeafSprigIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M8 14V4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M8 6c1.5-1.5 4-1.5 4.5 0-1 1.8-3 2-4.5 0zM8 9c-1.5-1.5-4-1.5-4.5 0 1 1.8 3 2 4.5 0z" fill={color} opacity="0.85" />
  </svg>
);

export const FlaskDropIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M6.5 2h3M7 2v4l-3.3 6.2A1.2 1.2 0 0 0 4.8 14h6.4a1.2 1.2 0 0 0 1.1-1.8L9 6V2" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Resolves the right generic icon for an ingredient by type + keyword —
 * mirrors how the mockups themselves only ever drew a handful of icon
 * archetypes (grain sprig, salt crystal, droplet, spore cluster) rather than
 * one bespoke icon per SKU.
 */
export function getIngredientIcon(ingredient: Pick<Ingredient, 'id' | 'name' | 'type' | 'tags' | 'isLiving'>): React.FC<IconProps> {
  const n = (ingredient.name + ' ' + ingredient.id).toLowerCase();
  if (ingredient.type === IngredientType.STARTER || ingredient.isLiving) return SporeClusterIcon;
  if (n.includes('salt')) return SaltCrystalIcon;
  if (n.includes('water') || n.includes('milk')) return WaterDropIcon;
  if (ingredient.tags?.includes('SEAFOOD') || n.includes('fish') || n.includes('anchov') || n.includes('mackerel')) return FishIcon;
  if (n.includes('chili') || n.includes('pepper')) return PepperIcon;
  if (n.includes('rose') || n.includes('pine') || n.includes('herb') || n.includes('flower')) return LeafSprigIcon;
  if (ingredient.type === IngredientType.ADDITIVE) return FlaskDropIcon;
  return GrainSprigIcon;
}

/* =========================================================================
   TOOL / MACHINERY ICONS (Workshop)
   ========================================================================= */

export const ClipFanIcon: React.FC<IconProps> = ({ size = 17, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="1.8" fill={color} />
    <ellipse cx="12" cy="7" rx="2.6" ry="4.2" stroke={color} strokeWidth="1.3" />
    <ellipse cx="16.5" cy="14.5" rx="2.6" ry="4.2" stroke={color} strokeWidth="1.3" transform="rotate(120 16.5 14.5)" />
    <ellipse cx="7.5" cy="14.5" rx="2.6" ry="4.2" stroke={color} strokeWidth="1.3" transform="rotate(-120 7.5 14.5)" />
  </svg>
);

export const MisterIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className, style }) => (
  <svg width={size} height={typeof size === 'number' ? size * (17 / 14) : size} viewBox="0 0 16 20" fill="none" className={className} style={style}>
    <path d="M8 2s4.5 5.2 4.5 8.2a4.5 4.5 0 0 1-9 0C3.5 7.2 8 2 8 2z" stroke={color} strokeWidth="1.4" />
  </svg>
);

export const HydroPressIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="4" y="3" width="16" height="6" rx="1" stroke={color} strokeWidth="1.4" />
    <rect x="4" y="15" width="16" height="6" rx="1" stroke={color} strokeWidth="1.4" />
    <path d="M12 9v6" stroke={color} strokeWidth="1.4" />
  </svg>
);

export const CentrifugeIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.4" />
    <path d="M12 12 18 8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.6" fill={color} />
  </svg>
);

export function getToolIcon(toolId: string): React.FC<IconProps> {
  switch (toolId) {
    case 'portable_fan': return ClipFanIcon;
    case 'humidifier': return MisterIcon;
    case 'wooden_press': return HydroPressIcon;
    case 'centrifuge': return CentrifugeIcon;
    default: return WrenchIcon;
  }
}

/* =========================================================================
   STAFF ROLE ICONS
   ========================================================================= */

export const PorterIcon: React.FC<IconProps> = ({ size = 20, color = '#9db8c9', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M14 3L9 15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 15.5l-3 5.5M9 15.5v5.5M9 15.5l3 5.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M6.5 16h6" stroke={color} strokeWidth="1.2" />
  </svg>
);

export const TechnicianIcon: React.FC<IconProps> = ({ size = 20, color = '#d99479', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M12 3v10.5a4 4 0 1 0 2 0V3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M10.5 4.5h3" stroke={color} strokeWidth="1.2" />
  </svg>
);

export const ChefHatIcon: React.FC<IconProps> = ({ size = 20, color = '#e7c77b', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="8" y="16" width="8" height="5" rx="1" stroke={color} strokeWidth="1.4" />
    <ellipse cx="12" cy="9" rx="6.2" ry="5.8" stroke={color} strokeWidth="1.3" />
    <circle cx="6.3" cy="9.5" r="2.4" stroke={color} strokeWidth="1.1" />
    <circle cx="17.7" cy="9.5" r="2.4" stroke={color} strokeWidth="1.1" />
  </svg>
);

export const RnDIcon: React.FC<IconProps> = ({ size = 20, color = '#9d8bb0', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="10.5" cy="10.5" r="6" stroke={color} strokeWidth="1.4" />
    <path d="M15 15l5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function getStaffIcon(roleId: StaffRoleType): React.FC<IconProps> {
  switch (roleId) {
    case 'cleaner': return PorterIcon;
    case 'tech': return TechnicianIcon;
    case 'chef': return ChefHatIcon;
    case 'rd': return RnDIcon;
    default: return StaffGroupIcon;
  }
}

/* =========================================================================
   BUYER TYPE ICONS
   ========================================================================= */

// "Culinary Co-op" style — a fork silhouette. Used for Private buyers.
export const ForkKnifeIcon: React.FC<IconProps> = ({ size = 12, color = 'var(--moss)', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M6 2v8M4 2v4a2 2 0 0 0 4 0V2M18 2v20M18 2c-2 0-3 2-3 5s1 4 3 4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// "Noma Table" style — a plate with rising steam. Used for Restaurant buyers.
export const DiningPlateIcon: React.FC<IconProps> = ({ size = 12, color = 'var(--amber)', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M4 8c2-3 14-3 16 0M5 8l1 12h12l1-12" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Basket icon — Supermarket buyers.
export const BasketIcon: React.FC<IconProps> = ({ size = 12, color = 'var(--brick)', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M4 9h16l-1.5 10a1.5 1.5 0 0 1-1.5 1.3H7A1.5 1.5 0 0 1 5.5 19z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M8 9l1-5h6l1 5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// Gear icon — Industry buyers.
export const GearIcon: React.FC<IconProps> = ({ size = 12, color = 'var(--teal)', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.4" />
    <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18 6l-1.7 1.7M7.7 16.3 6 18M18 18l-1.7-1.7M7.7 7.7 6 6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// Same shield glyph as the Underground channel toggle. Used for Underground buyers.
export const UndergroundHoodIcon: React.FC<IconProps> = ({ size = 12, color = 'var(--plum)', className, style }) => (
  <ShieldIcon size={size} color={color} />
);

export function getBuyerIcon(type: BuyerType): React.FC<IconProps> {
  switch (type) {
    case 'Restaurant': return DiningPlateIcon;
    case 'Private': return ForkKnifeIcon;
    case 'Supermarket': return BasketIcon;
    case 'Industry': return GearIcon;
    case 'Underground': return UndergroundHoodIcon;
    default: return ForkKnifeIcon;
  }
}

export function getBuyerAccentColor(type: BuyerType): string {
  switch (type) {
    case 'Restaurant': return 'var(--amber)';
    case 'Private': return 'var(--moss)';
    case 'Supermarket': return 'var(--brick)';
    case 'Industry': return 'var(--teal)';
    case 'Underground': return 'var(--plum)';
    default: return 'var(--moss)';
  }
}

/* =========================================================================
   BATCH INTERVENTION TOOL ICONS (Inspector)
   ========================================================================= */

export const MixToolIcon: React.FC<IconProps> = ({ size = 18, color = '#c8935a', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M12 21V8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <ellipse cx="12" cy="5.3" rx="4" ry="2.8" stroke={color} strokeWidth="1.4" transform="rotate(18 12 5.3)" />
  </svg>
);

export const MistToolIcon: React.FC<IconProps> = ({ size = 18, color = '#8a9a6b', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" stroke={color} strokeWidth="1.5" />
  </svg>
);

export const LidToolIcon: React.FC<IconProps> = ({ size = 18, color = '#9d8bb0', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M5 10h14v9H5z" stroke={color} strokeWidth="1.4" />
    <path d="M4 10l3-5h10l3 5" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const CleanToolIcon: React.FC<IconProps> = ({ size = 18, color = '#e7c77b', className, style }) => (
  <PorterIcon size={size} color={color} />
);

/* =========================================================================
   WELCOME SCREEN LEDGER ICONS
   ========================================================================= */

export const ScienceIcon = ClockIcon;
export const LabLedgerIcon = WrenchIcon;
export const MarketLedgerIcon = CheckCircleIcon;
