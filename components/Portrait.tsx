import React from 'react';
import { PEOPLE_SHEET, PEOPLE_COLS, PEOPLE_CELL, portraitIndex } from './peopleSheet';
import { KEEPER_FACES } from './keeperSheet';
import { FARM_FACES } from './farmFaceSheet';
import { StaffRoleType } from '../types';

/**
 * A FACE FOR A GENERATED PERSON.
 *
 * Sliced out of the one sheet by a hash of the member's id, so the same hire
 * keeps the same face for as long as they work for you without the crew record
 * having to carry a portrait field for `migrate()` to backfill.
 */
const Portrait: React.FC<{ seed: string; size?: number; className?: string; role?: StaffRoleType }> = ({ seed, size = 44, className, role }) => {
  const i = portraitIndex(seed);
  // A koji keeper wears the room's clothes, and a farm hand their own working clothes:
  // those roles take their faces from their own few.
  const own = role === 'toji' ? KEEPER_FACES : role ? FARM_FACES[role] : undefined;
  if (own?.length) {
    return (
      <span className={`portrait${className ? ' ' + className : ''}`} role="img" aria-hidden="true"
            style={{ width: size, height: size, backgroundImage: `url(${own[i % own.length]})`,
                     backgroundSize: 'cover', backgroundPosition: 'center bottom', backgroundRepeat: 'no-repeat' }} />
    );
  }
  const col = i % PEOPLE_COLS;
  const row = Math.floor(i / PEOPLE_COLS);
  const k = size / PEOPLE_CELL;
  return (
    <span
      className={`portrait${className ? ' ' + className : ''}`}
      role="img"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${PEOPLE_SHEET})`,
        backgroundSize: `${PEOPLE_CELL * PEOPLE_COLS * k}px auto`,
        backgroundPosition: `-${col * PEOPLE_CELL * k}px -${row * PEOPLE_CELL * k}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

export default Portrait;
