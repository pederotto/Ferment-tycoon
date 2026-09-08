import React from 'react';

/**
 * THE INK
 *
 * The reference direction is hand-drawn: contour lines with a wobble in them,
 * flat fills, no gradients. Redrawing sixty-odd vessel and hardware paths by
 * hand to get that would take a week and drift out of consistency the first time
 * anything was added.
 *
 * Instead the wobble is a filter. feTurbulence generates a noise field and
 * feDisplacementMap pushes every edge along it by a pixel or two — which is
 * exactly what a pen does when a person is holding it. One definition, mounted
 * once, and every vessel, appliance and room fixture inherits the same hand.
 *
 * Two strengths because scale matters: a 2 L jar drawn at 0.8 needs less
 * displacement than a 60 L cask at 1.4, or the small ones dissolve.
 *
 * The `seed` differs per filter so two objects side by side do not wobble
 * identically, which is the tell that gives away a filter.
 */

const InkDefs: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
    <defs>
      <filter id="inkRough" x="-12%" y="-12%" width="124%" height="124%">
        <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="7" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      <filter id="inkRoughFine" x="-12%" y="-12%" width="124%" height="124%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="19" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* Printed ink sits slightly unevenly on board — a touch of the same noise
          multiplied over the fill is what stops a flat colour reading as vector. */}
      <filter id="inkTooth" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="3" result="t" />
        <feColorMatrix in="t" type="saturate" values="0" result="g" />
        <feComponentTransfer in="g" result="a">
          <feFuncA type="linear" slope="0.16" intercept="0" />
        </feComponentTransfer>
        <feComposite in="a" in2="SourceGraphic" operator="in" result="grain" />
        <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
      </filter>
    </defs>
  </svg>
);

export default InkDefs;
