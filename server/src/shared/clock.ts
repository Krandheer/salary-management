import type { IsoDate } from '@acme/contracts';

export interface Clock {
  today(): IsoDate;
  now(): string;
}

export function systemClock(_timeZone: string): Clock {
  throw new Error('not implemented');
}

export function fixedClock(_today: IsoDate): Clock {
  throw new Error('not implemented');
}
