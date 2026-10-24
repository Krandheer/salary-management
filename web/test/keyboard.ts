import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

const MOST_TABS_TO_REACH_A_CONTROL = 40;

/** Presses Tab until `element` has focus; fails if the keyboard cannot reach it. */
export async function tabTo(user: UserEvent, element: HTMLElement): Promise<void> {
  for (let presses = 0; presses < MOST_TABS_TO_REACH_A_CONTROL; presses += 1) {
    if (element === document.activeElement) return;
    await user.tab();
  }
  expect(element).toHaveFocus();
}
