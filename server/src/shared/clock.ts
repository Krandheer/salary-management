import type { IsoDate } from '@acme/contracts';

export interface Clock {
  today(): IsoDate;
  now(): string;
}

export function systemClock(timeZone: string): Clock {
  const dateFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return {
    today: () => dateFormat.format(new Date()),
    now: () => new Date().toISOString(),
  };
}

export function fixedClock(today: IsoDate): Clock {
  return { today: () => today, now: () => `${today}T00:00:00.000Z` };
}
