import { WeatherState, WeatherType } from '../types';

/* =============================================================================
   THE CLIMATE: 45°N, BETWEEN THE LANGHE AND THE RHÔNE

   One estate, one sky. The lab has always had a week of weather; the farm needs
   the DAY it stands for — whether it froze last night, how much rain fell, how
   long the light lasts — so this module turns the weekly weather the lab already
   reads into daily detail, deterministically, so the bench and the beds can
   never disagree about what happened.

   The numbers are a hill farm at about 300 m around 45°N (Turin, Asti, Lyon,
   Valence): January averages 2-3 °C and July 23, rain peaks in spring and again
   in October-November, July is the dry month, and winter brings valley fog far
   more often than snow. Day length runs from 8 h 50 at the winter solstice to
   15 h 30 at midsummer, on central European time with summer time.

   PURE and SEEDED. Every function takes a date and returns the same answer every
   time, because the day loop runs inside a state updater that StrictMode calls
   twice. `Math.random` has no place here; a week's weather is a hash of the year
   and the week, and a day's detail a hash of the day.
   ============================================================================= */

export const LATITUDE = 45.0;
/** 12 months of 4 weeks of 7 days. The game's calendar, not the real one. */
export const DAYS_PER_YEAR = 336;
/** A lab tick is three hours: eight a day, which is what the bench was balanced on. */
export const MINUTES_PER_TICK = 180;
export const TICKS_PER_DAY = 8;
export const MINUTES_PER_DAY = 1440;

export interface CalendarDate { year: number; month: number; week: number; day: number }

/** Day within the game year, 0-335. Weeks 1-4 of the run are the first month on the clock. */
export const dayOfYear = (d: Pick<CalendarDate, 'month' | 'week' | 'day'>): number =>
  d.month * 28 + ((d.week - 1) % 4) * 7 + (d.day - 1);

/** A day number that only ever goes up. The farm keys every date on this. */
export const absoluteDay = (d: CalendarDate): number => (d.year - 1) * DAYS_PER_YEAR + dayOfYear(d);

/** The real calendar day (1-365) that a game day stands for. The sun reads this. */
export const realDayOfYear = (doy: number): number => 1 + ((doy + 0.5) * 365) / DAYS_PER_YEAR;

/* -----------------------------------------------------------------------------
   SEEDED NUMBERS
   --------------------------------------------------------------------------- */
export const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/** A small LCG. Good enough for weather and pests; never for anything a player can farm. */
export const seededRandom = (seed: number) => {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
};

/** One uniform number in [0,1) for a named event. */
export const roll = (...parts: (string | number)[]): number => seededRandom(hashString(parts.join('|')))();

/* -----------------------------------------------------------------------------
   THE SUN
   --------------------------------------------------------------------------- */
const RAD = Math.PI / 180;

const declination = (n: number): number => 23.44 * RAD * Math.sin((2 * Math.PI * (284 + n)) / 365);

export interface SunTimes {
  /** Minutes after midnight, clock time. */
  sunrise: number;
  sunset: number;
  /** Minutes of daylight. */
  daylight: number;
}

/**
 * Sunrise and sunset on the clock. Standard refraction (-0.833°), the equation
 * of time, the longitude of Turin (7.7°E) against the CET meridian, and summer
 * time from the end of March to the end of October. Checked against Turin:
 * 21 December 08:06-16:44, 21 June 05:43-21:18.
 */
export const sunTimes = (doy: number): SunTimes => {
  const n = realDayOfYear(doy);
  const d = declination(n);
  const phi = LATITUDE * RAD;
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d));
  const w0 = Math.acos(Math.max(-1, Math.min(1, cosW))) / RAD;   // degrees
  const daylight = (2 * w0 / 15) * 60;
  const B = (2 * Math.PI * (n - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);   // minutes
  const dst = n >= 87 && n <= 300 ? 60 : 0;
  const noon = 12 * 60 + (15 - 7.7) * 4 - eot + dst;
  return { sunrise: Math.round(noon - daylight / 2), sunset: Math.round(noon + daylight / 2), daylight: Math.round(daylight) };
};

/** Extraterrestrial radiation, MJ/m²/day. What drives evaporation and ripening. */
export const extraterrestrialRadiation = (doy: number): number => {
  const n = realDayOfYear(doy);
  const d = declination(n);
  const phi = LATITUDE * RAD;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * n) / 365);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(d))));
  return (24 * 60 / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.sin(ws));
};

/* -----------------------------------------------------------------------------
   NORMALS
   Monthly means for a hill farm around Asti or the Drôme, with the mean
   diurnal range. Interpolated across the month on a cosine so there is no step
   at the first of the month.
   --------------------------------------------------------------------------- */
export const MONTHLY_MEAN_C  = [2.5, 4.5, 8.5, 12.0, 16.5, 20.5, 23.0, 22.5, 18.5, 13.0, 7.5, 3.5];
export const MONTHLY_RANGE_C = [7.0, 8.5, 10.0, 11.0, 11.0, 11.5, 12.0, 11.5, 10.5, 9.0, 7.0, 6.5];

const interpMonthly = (table: number[], doy: number): number => {
  const pos = doy / 28 - 0.5;               // month midpoints sit at .5
  const i0 = Math.floor(pos);
  const f = pos - i0;
  const a = table[((i0 % 12) + 12) % 12];
  const b = table[(((i0 + 1) % 12) + 12) % 12];
  const t = (1 - Math.cos(f * Math.PI)) / 2;
  return a + (b - a) * t;
};

export const normalMeanTemp = (doy: number): number => interpMonthly(MONTHLY_MEAN_C, doy);
export const normalRange = (doy: number): number => interpMonthly(MONTHLY_RANGE_C, doy);

/* -----------------------------------------------------------------------------
   THE WEEK'S WEATHER

   Per-month odds rather than per-season, because the months at 45°N are not
   alike: November is fog and rain, September is the best month of the year,
   and July is the one that dries out. The lab reads tempModifier and
   humidityModifier exactly as it always has; the magnitudes are the ones the
   spoilage odds were measured on, so only the FREQUENCY of each kind of week
   has changed.
   --------------------------------------------------------------------------- */
const TYPES: WeatherType[] = ['Sunny', 'Cloudy', 'Rainy', 'Stormy', 'Foggy', 'Snowy', 'Heatwave'];
const ODDS: number[][] = [
  //  Sun  Cloud Rain Storm Fog  Snow Heat
  [0.30, 0.22, 0.10, 0.00, 0.28, 0.10, 0.00], // Jan
  [0.32, 0.22, 0.14, 0.00, 0.20, 0.12, 0.00], // Feb
  [0.36, 0.24, 0.26, 0.02, 0.08, 0.04, 0.00], // Mar
  [0.34, 0.24, 0.34, 0.06, 0.02, 0.00, 0.00], // Apr
  [0.34, 0.18, 0.30, 0.16, 0.02, 0.00, 0.00], // May
  [0.44, 0.12, 0.12, 0.22, 0.00, 0.00, 0.10], // Jun
  [0.52, 0.08, 0.04, 0.16, 0.00, 0.00, 0.20], // Jul
  [0.50, 0.10, 0.06, 0.18, 0.00, 0.00, 0.16], // Aug
  [0.54, 0.16, 0.14, 0.10, 0.04, 0.00, 0.02], // Sep
  [0.30, 0.20, 0.28, 0.12, 0.10, 0.00, 0.00], // Oct
  [0.18, 0.22, 0.30, 0.10, 0.20, 0.00, 0.00], // Nov
  [0.24, 0.26, 0.14, 0.00, 0.26, 0.10, 0.00], // Dec
];

const seasonOf = (m: number): 'winter' | 'spring' | 'summer' | 'autumn' =>
  m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';

/** What the lab feels and what the header says, by kind of week and season. */
const weatherState = (type: WeatherType, month: number): WeatherState => {
  const s = seasonOf(month);
  switch (type) {
    case 'Heatwave': return { type, tempModifier: 8, humidityModifier: -20, description: 'Canicule' };
    case 'Snowy':    return { type, tempModifier: -8, humidityModifier: -10, description: 'Snow on the hills' };
    case 'Foggy':    return s === 'winter' || s === 'autumn'
      ? { type, tempModifier: -2, humidityModifier: 30, description: 'Valley fog' }
      : { type, tempModifier: -2, humidityModifier: 30, description: 'Morning mist' };
    case 'Stormy':   return s === 'summer'
      ? { type, tempModifier: -2, humidityModifier: 20, description: 'Thunderstorms' }
      : { type, tempModifier: -3, humidityModifier: 15, description: 'Storms off the sea' };
    case 'Rainy':    return s === 'spring'
      ? { type, tempModifier: -1, humidityModifier: 25, description: 'Spring rain' }
      : s === 'summer'
        ? { type, tempModifier: -2, humidityModifier: 20, description: 'A wet week' }
        : { type, tempModifier: -2, humidityModifier: 12, description: s === 'autumn' ? 'Autumn rain' : 'Cold rain' };
    case 'Cloudy':   return s === 'summer'
      ? { type, tempModifier: 0, humidityModifier: 10, description: 'Close and grey' }
      : { type, tempModifier: -2, humidityModifier: 0, description: 'Overcast' };
    case 'Sunny':
    default:         return s === 'summer'
      ? { type: 'Sunny', tempModifier: 3, humidityModifier: -5, description: 'Clear skies' }
      : s === 'winter'
        ? { type: 'Sunny', tempModifier: -4, humidityModifier: -15, description: 'Cold and clear' }
        : s === 'spring'
          ? { type: 'Sunny', tempModifier: 2, humidityModifier: 5, description: 'Mild and bright' }
          : { type: 'Sunny', tempModifier: 1, humidityModifier: -5, description: 'Crisp' };
  }
};

/**
 * The weather for a week, from the year, the absolute week and the month it
 * falls in. Seeded, so the two runs of a StrictMode updater agree and the farm
 * can look back at any week it needs to.
 */
export const weatherForWeek = (year: number, week: number, month: number): WeatherState => {
  const r = roll('wx', year, week);
  const odds = ODDS[((month % 12) + 12) % 12];
  let acc = 0;
  for (let i = 0; i < TYPES.length; i++) {
    acc += odds[i];
    if (r < acc) return weatherState(TYPES[i], month);
  }
  return weatherState('Cloudy', month);
};

/* -----------------------------------------------------------------------------
   THE DAY'S WEATHER, OUTSIDE

   What the beds feel. Derived from the week's type: a rainy week is rain on
   most days, not every one; a sunny winter week is a string of hard frosts; a
   stormy summer week is heat broken by a downpour and sometimes hail.
   --------------------------------------------------------------------------- */
export interface DayWeather {
  tMin: number;
  tMax: number;
  tMean: number;
  rainMm: number;
  /** Share of the possible sunshine, 0-1. Ripening reads this. */
  sun: number;
  /** Reference evapotranspiration, mm. What a full crop drinks on a well-watered day. */
  et0: number;
  frost: boolean;
  hardFrost: boolean;
  hail: boolean;
  snow: boolean;
  /** A line for the almanac. */
  label: string;
}

interface DayRule { anomaly: number; rangeF: number; rainP: number; rainMm: number; sun: number }
const DAY_RULES: Record<WeatherType, DayRule> = {
  Sunny:    { anomaly: 1.0,  rangeF: 1.25, rainP: 0.05, rainMm: 2,  sun: 0.90 },
  Heatwave: { anomaly: 6.0,  rangeF: 1.20, rainP: 0.08, rainMm: 10, sun: 0.95 },
  Cloudy:   { anomaly: 0.0,  rangeF: 0.70, rainP: 0.25, rainMm: 3,  sun: 0.40 },
  Rainy:    { anomaly: -1.5, rangeF: 0.60, rainP: 0.75, rainMm: 9,  sun: 0.25 },
  Stormy:   { anomaly: -1.5, rangeF: 0.85, rainP: 0.50, rainMm: 18, sun: 0.45 },
  Foggy:    { anomaly: -1.0, rangeF: 0.50, rainP: 0.10, rainMm: 1,  sun: 0.30 },
  Snowy:    { anomaly: -5.0, rangeF: 0.70, rainP: 0.60, rainMm: 8,  sun: 0.20 },
};

const winterMonth = (m: number) => m >= 11 || m <= 1;
const anomalyOf = (type: WeatherType, month: number): number =>
  // A clear winter week is COLD, not warm: the sky is open at night.
  type === 'Sunny' && winterMonth(month) ? -1.5 : (DAY_RULES[type] ?? DAY_RULES.Cloudy).anomaly;

/**
 * What the kinds of week add to a month on average. Subtracted again, so a
 * month's weather sums to its normal: a July of heatwaves is hot because it
 * had heatwaves, not because every July runs warm.
 */
const EXPECTED_ANOMALY = ODDS.map((odds, m) => odds.reduce((a, p, i) => a + p * anomalyOf(TYPES[i], m), 0));

export const dayWeather = (date: CalendarDate, week: WeatherState): DayWeather => {
  const doy = dayOfYear(date);
  const rule = DAY_RULES[week.type] ?? DAY_RULES.Cloudy;
  const r = seededRandom(hashString(`day|${date.year}|${date.week}|${date.day}`));
  // A whole week runs warm or cold together, and each day wanders about that.
  const weekly = (roll('wk-anom', date.year, date.week) - 0.5) * 4;
  const noise = (r() + r() + r() + r() - 2) * 4.3;        // SD about 2.5 °C, bell-shaped
  const anomaly = anomalyOf(week.type, date.month) - EXPECTED_ANOMALY[((date.month % 12) + 12) % 12];
  const tMean = normalMeanTemp(doy) + anomaly + weekly + noise;
  const range = normalRange(doy) * rule.rangeF * (0.8 + r() * 0.4);
  const tMin = tMean - range / 2;
  const tMax = tMean + range / 2;
  const wet = r() < rule.rainP;
  const rainMm = wet ? rule.rainMm * (0.4 + r() * 1.2) : 0;
  const sun = Math.max(0, Math.min(1, rule.sun + (r() - 0.5) * 0.2 - (wet ? 0.15 : 0)));
  const ra = extraterrestrialRadiation(doy);
  const et0 = Math.max(0.1, 0.0023 * (tMean + 17.8) * Math.sqrt(Math.max(1, tMax - tMin)) * ra * 0.408) * (0.6 + sun * 0.5);
  const snow = wet && tMean < 1.5;
  const hail = week.type === 'Stormy' && date.month >= 4 && date.month <= 8 && wet && r() < 0.12;
  const frost = tMin < 0;
  const hardFrost = tMin < -4;
  const label = hail ? 'Hail'
    : snow ? 'Snow'
    : wet && rainMm > 15 ? 'Heavy rain'
    : wet ? 'Rain'
    : hardFrost ? 'Hard frost'
    : frost ? 'Frost'
    : week.type === 'Foggy' ? 'Fog'
    : sun > 0.75 ? (tMax > 32 ? 'Scorching' : 'Sunny')
    : 'Grey';
  return { tMin, tMax, tMean, rainMm, sun, et0, frost, hardFrost, hail, snow, label };
};

/* -----------------------------------------------------------------------------
   THE CLOCK
   --------------------------------------------------------------------------- */
export const formatClock = (minute: number): string => {
  const m = ((Math.round(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const formatDuration = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${String(r).padStart(2, '0')}`;
};

/** Light left today, in minutes. Zero before dawn is not "no light left": it is not yet light. */
export const lightLeft = (doy: number, minute: number): number => {
  const s = sunTimes(doy);
  return Math.max(0, s.sunset - Math.max(minute, s.sunrise));
};

export const isDaylight = (doy: number, minute: number): boolean => {
  const s = sunTimes(doy);
  return minute >= s.sunrise && minute < s.sunset;
};
