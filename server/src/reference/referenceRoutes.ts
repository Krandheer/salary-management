import type { Router } from 'express';
import type { Clock } from '../shared/clock.ts';

export function referenceRouter(_clock: Clock): Router {
  throw new Error('not implemented');
}
