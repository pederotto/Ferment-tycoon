import React from 'react';
import { VESSEL_ART } from './vesselSheet';
import { VesselLineIcon } from './icons';

/**
 * A VESSEL, AS A PICTURE.
 *
 * The painting where the sheet had one, the line drawing where it did not (the
 * Cedar Tray). Height is the unit because vessels are tall things of different
 * widths — at the same height a glass fermenter is half the width of a muro.
 */
const VesselArt: React.FC<{ vesselId: string; height: number; className?: string }> = ({ vesselId, height, className }) => {
  const art = VESSEL_ART[vesselId];
  if (!art) return <VesselLineIcon vesselId={vesselId} size={Math.round(height * 0.62)} color="currentColor" />;
  return (
    <img
      className={`vessel-art${className ? ` ${className}` : ''}`}
      src={art.src}
      width={Math.round(height * (art.w / art.h))}
      height={height}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
};

export default VesselArt;
