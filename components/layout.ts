/* THE COMPACT LAYOUT: a phone, or a tablet held upright. The rail becomes a
   drawer behind the menu button and the paintings fill the height and pan
   sideways. index.css states the same query in its "COMPACT" block; keep the two
   the same. */
export const COMPACT_QUERY = '(max-width: 759px), (max-width: 1179px) and (orientation: portrait)';
export const isCompact = () => typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches;
