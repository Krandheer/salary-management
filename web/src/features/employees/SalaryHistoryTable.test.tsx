import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SalaryHistoryEntry } from '@acme/contracts';
import { SalaryHistoryTable } from './SalaryHistoryTable';

function anEntry(overrides: Partial<SalaryHistoryEntry>): SalaryHistoryEntry {
  return {
    id: 1,
    amount: 80_000,
    currency: 'USD',
    effectiveDate: '2022-01-01',
    reason: null,
    recordedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

function bodyRows() {
  return screen.getAllByRole('row').slice(1);
}

describe('SalaryHistoryTable', () => {
  it('shows each entry with its currency and amount, effective date and reason in the given order', () => {
    render(
      <SalaryHistoryTable
        entries={[
          anEntry({ id: 3, amount: 95_000, effectiveDate: '2025-06-01', reason: 'Promotion' }),
          anEntry({
            id: 1,
            amount: 1_850_000,
            currency: 'INR',
            effectiveDate: '2020-01-15',
            reason: 'Starting salary',
          }),
        ]}
      />,
    );

    const [newest, oldest] = bodyRows();
    expect(newest).toHaveTextContent('2025-06-01');
    expect(newest).toHaveTextContent('USD 95,000');
    expect(newest).toHaveTextContent('Promotion');
    expect(oldest).toHaveTextContent('2020-01-15');
    expect(oldest).toHaveTextContent('INR 1,850,000');
    expect(oldest).toHaveTextContent('Starting salary');
  });

  it('shows a dash for an entry without a reason', () => {
    render(<SalaryHistoryTable entries={[anEntry({ reason: null })]} />);

    expect(within(bodyRows()[0]!).getByText('—')).toBeInTheDocument();
  });

  it('marks only the first entry as the current salary', () => {
    render(
      <SalaryHistoryTable
        entries={[anEntry({ id: 2, amount: 90_000 }), anEntry({ id: 1, amount: 80_000 })]}
      />,
    );

    const [first, second] = bodyRows();
    expect(within(first!).getByText('Current')).toBeInTheDocument();
    expect(within(second!).queryByText('Current')).not.toBeInTheDocument();
    expect(screen.getAllByText('Current')).toHaveLength(1);
  });

  it('shows a long reason in full', () => {
    const reason = 'Reason '.repeat(500).trim();

    render(<SalaryHistoryTable entries={[anEntry({ reason })]} />);

    expect(screen.getByText(reason)).toBeInTheDocument();
  });
});
