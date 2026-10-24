import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ImportPreview } from '@acme/contracts';
import { renderWithProviders } from '../../../test/render';
import { ImportPreviewView } from './ImportPreviewView';

function aPreview(overrides: Partial<ImportPreview> = {}): ImportPreview {
  const preview = {
    creates: [
      { row: 4, email: 'gone@acme.example', rehireOf: 12 },
      { row: 5, email: 'new@acme.example', rehireOf: null },
    ],
    updates: [
      {
        row: 3,
        email: 'raise@acme.example',
        changes: [
          { field: 'Annual Salary', from: '85000', to: '90000' },
          { field: 'Job Title', from: 'Designer', to: 'Lead Designer' },
        ],
      },
    ],
    errors: [
      {
        row: 6,
        email: 'cy@acme.example',
        messages: [
          'Currency: Currency must be USD for United States',
          'Hire Date: Hire date cannot be in the future',
        ],
      },
    ],
    ...overrides,
  };
  return {
    totals: {
      create: preview.creates.length,
      update: preview.updates.length,
      unchanged: 3,
      error: preview.errors.length,
    },
    ...preview,
  };
}

function manyCreates(count: number): ImportPreview['creates'] {
  return Array.from({ length: count }, (_, index) => ({
    row: index + 2,
    email: `person.${index + 2}@acme.example`,
    rehireOf: null,
  }));
}

describe('ImportPreviewView', () => {
  it('shows the count of each outcome with its label', () => {
    renderWithProviders(<ImportPreviewView preview={aPreview()} />);

    const totals = screen.getByRole('list', { name: 'Import totals' });
    expect(
      within(totals)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Create 2', 'Update 1', 'Unchanged 3', 'Errors 1']);
  });

  it('opens on the errors, showing each row number with every message', () => {
    renderWithProviders(<ImportPreviewView preview={aPreview()} />);

    const errors = screen.getByRole('tabpanel', { name: /Errors/ });
    expect(within(errors).getByText('Row 6')).toBeInTheDocument();
    expect(within(errors).getByText('cy@acme.example')).toBeInTheDocument();
    expect(
      within(errors).getByText('Currency: Currency must be USD for United States'),
    ).toBeInTheDocument();
    expect(
      within(errors).getByText('Hire Date: Hire date cannot be in the future'),
    ).toBeInTheDocument();
  });

  it('lists every field an update changes, from the old value to the new one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportPreviewView preview={aPreview()} />);

    await user.click(screen.getByRole('tab', { name: /Updates/ }));

    const updates = screen.getByRole('tabpanel', { name: /Updates/ });
    expect(within(updates).getByText('Row 3')).toBeInTheDocument();
    expect(within(updates).getByText('raise@acme.example')).toBeInTheDocument();
    expect(within(updates).getByRole('row', { name: 'Annual Salary 85000 90000' })).toBeVisible();
    expect(
      within(updates).getByRole('row', { name: 'Job Title Designer Lead Designer' }),
    ).toBeVisible();
  });

  it('names the inactive record a rehire will be linked to', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportPreviewView preview={aPreview()} />);

    await user.click(screen.getByRole('tab', { name: /Creates/ }));

    const creates = screen.getByRole('tabpanel', { name: /Creates/ });
    expect(within(creates).getByRole('row', { name: /gone@acme\.example/ })).toHaveTextContent(
      'Rehire — linked to #12',
    );
    expect(within(creates).getByRole('row', { name: /new@acme\.example/ })).toHaveTextContent(
      'New employee',
    );
  });

  it('opens on the first group that has rows when there are no errors', () => {
    renderWithProviders(<ImportPreviewView preview={aPreview({ errors: [], updates: [] })} />);

    expect(screen.getByRole('tab', { name: /Creates/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows 50 rows per page and pages through the rest', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ImportPreviewView
        preview={aPreview({ errors: [], updates: [], creates: manyCreates(120) })}
      />,
    );

    const creates = screen.getByRole('tabpanel', { name: /Creates/ });
    const bodyRows = () => within(creates).getAllByRole('row').slice(1);
    expect(bodyRows()).toHaveLength(50);
    expect(within(creates).getByText('Page 1 of 3')).toBeInTheDocument();

    await user.click(within(creates).getByRole('button', { name: 'Next' }));
    await user.click(within(creates).getByRole('button', { name: 'Next' }));

    expect(within(creates).getByText('Page 3 of 3')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(20);
    expect(bodyRows()[0]).toHaveTextContent('person.102@acme.example');
  });

  it('does not show paging when a group fits on one page', () => {
    renderWithProviders(<ImportPreviewView preview={aPreview()} />);

    const errors = screen.getByRole('tabpanel', { name: /Errors/ });
    expect(within(errors).getByText('Row 6')).toBeInTheDocument();
    expect(
      within(errors).queryByRole('navigation', { name: 'Pagination' }),
    ).not.toBeInTheDocument();
  });
});
