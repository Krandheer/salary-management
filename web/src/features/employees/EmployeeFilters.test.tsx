import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { aReference } from '../../../test/fixtures';
import { EmployeeFilters, NO_FILTERS, type EmployeeFiltersValue } from './EmployeeFilters';

function renderFilters(
  overrides: Partial<EmployeeFiltersValue> = {},
  jobTitleOptions: string[] = [],
) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  renderWithProviders(
    <EmployeeFilters
      value={{ ...NO_FILTERS, ...overrides }}
      onChange={onChange}
      onClear={onClear}
      reference={aReference()}
      jobTitleOptions={jobTitleOptions}
    />,
  );
  return { onChange, onClear, user: userEvent.setup() };
}

async function optionNames(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  return screen.getAllByRole('option').map((option) => option.textContent);
}

describe('EmployeeFilters', () => {
  it('labels every control', () => {
    renderFilters();

    expect(screen.getByRole('textbox', { name: 'Search name' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Job title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('offers all 8 countries plus an "All countries" choice', async () => {
    const { user } = renderFilters();

    const names = await optionNames(user, 'Country');

    expect(names).toHaveLength(9);
    expect(names[0]).toBe('All countries');
    expect(names).toContain('India');
    expect(names).toContain('United Kingdom');
  });

  it('offers all 10 departments plus an "All departments" choice', async () => {
    const { user } = renderFilters();

    const names = await optionNames(user, 'Department');

    expect(names).toHaveLength(11);
    expect(names[0]).toBe('All departments');
    expect(names).toContain('Customer Support');
  });

  it('offers the job titles it is given, A to Z as supplied, plus an "All job titles" choice', async () => {
    const { user } = renderFilters({}, ['Analyst', 'Designer']);

    expect(await optionNames(user, 'Job title')).toEqual(['All job titles', 'Analyst', 'Designer']);
  });

  it('reports a chosen country', async () => {
    const { user, onChange } = renderFilters();
    await user.click(screen.getByRole('combobox', { name: 'Country' }));

    await user.click(screen.getByRole('option', { name: 'India' }));

    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, country: 'IN' });
  });

  it('reports a chosen department and job title', async () => {
    const { user, onChange } = renderFilters({}, ['Analyst']);

    await user.click(screen.getByRole('combobox', { name: 'Department' }));
    await user.click(screen.getByRole('option', { name: 'Finance' }));
    await user.click(screen.getByRole('combobox', { name: 'Job title' }));
    await user.click(screen.getByRole('option', { name: 'Analyst' }));

    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, department: 'Finance' });
    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, jobTitle: 'Analyst' });
  });

  it('reports a filter being set back to "All"', async () => {
    const { user, onChange } = renderFilters({ country: 'IN' });
    await user.click(screen.getByRole('combobox', { name: 'Country' }));

    await user.click(screen.getByRole('option', { name: 'All countries' }));

    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, country: '' });
  });

  it('shows the chosen filters', () => {
    renderFilters({ search: 'ana', country: 'IN' });

    expect(screen.getByRole('textbox', { name: 'Search name' })).toHaveValue('ana');
    expect(
      within(screen.getByRole('combobox', { name: 'Country' })).getByText('India'),
    ).toBeInTheDocument();
  });

  it('reports typed search text', async () => {
    const { user, onChange } = renderFilters();

    await user.type(screen.getByRole('textbox', { name: 'Search name' }), 'a');

    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, search: 'a' });
  });

  it('asks to clear the filters', async () => {
    const { user, onClear } = renderFilters({ country: 'IN' });

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
