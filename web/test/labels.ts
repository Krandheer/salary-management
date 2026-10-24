import { screen } from '@testing-library/react';
import { expect } from 'vitest';

const FORM_CONTROLS = 'input, select, textarea, button[role="combobox"]';

/** Fails when any visible control in `container` cannot be found through a visible label. */
export function expectEveryControlLabelled(container: HTMLElement): void {
  const controls = Array.from(container.querySelectorAll<HTMLElement>(FORM_CONTROLS)).filter(
    (control) => control.closest('[aria-hidden="true"]') === null,
  );
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) {
    const labels = (control as HTMLInputElement).labels;
    const labelText = labels?.[0]?.textContent?.trim() ?? '';
    expect(labelText, `a visible label for ${control.outerHTML.slice(0, 80)}`).not.toBe('');
    expect(screen.getAllByLabelText(labelText)).toContain(control);
  }
}
