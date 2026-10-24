import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeListPage as EmployeeListData, EmployeeSummary } from '@acme/contracts';
import { renderWithProviders } from '../../../test/render';
import { aReference } from '../../../test/fixtures';
import { ApiError, requestJson } from '@/api/http';
import { EmployeeListPage } from './EmployeeListPage';

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  requestJson: vi.fn(),
}));

const requestJsonMock = vi.mocked(requestJson);

function anEmployee(overrides: Partial<EmployeeSummary> = {}): EmployeeSummary {
  return {
    id: 1,
    fullName: 'Asha Rao',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    country: 'IN',
    currency: 'INR',
    currentSalary: 1_850_000,
    status: 'active',
    exitDate: null,
    ...overrides,
  };
}

function aPage(overrides: Partial<EmployeeListData> = {}): EmployeeListData {
  return { items: [anEmployee()], page: 1, pageSize: 25, total: 1, totalPages: 1, ...overrides };
}

/** Routes reference and job-title requests to fixtures and employee-list requests to `serveList`. */
function serveApi(
  serveList: (path: string) => EmployeeListData | Promise<EmployeeListData>,
  jobTitles: string[] = ['Analyst', 'Designer'],
) {
  requestJsonMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/reference')) return aReference();
    if (path.startsWith('/api/employees/job-titles')) return { jobTitles };
    return serveList(path);
  });
}

function listCalls(): string[] {
  return requestJsonMock.mock.calls
    .map(([path]) => path)
    .filter((path) => path.startsWith('/api/employees?') || path === '/api/employees');
}

/** Serves a two-page list (26 employees) keyed by the `page` query parameter. */
function serveTwoPages() {
  serveApi((path) => {
    const page = Number(new URL(path, 'http://localhost').searchParams.get('page') ?? '1');
    return page === 1
      ? aPage({ items: [anEmployee({ id: 1, fullName: 'Asha Rao' })], total: 26, totalPages: 2 })
      : aPage({
          items: [anEmployee({ id: 26, fullName: 'Zed Young' })],
          page: 2,
          total: 26,
          totalPages: 2,
        });
  });
}

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('EmployeeListPage', () => {
  it('shows each employee with name, job title, department, country and formatted salary', async () => {
    serveApi(() =>
      aPage({
        items: [
          anEmployee(),
          anEmployee({
            id: 2,
            fullName: 'John Miller',
            jobTitle: 'Designer',
            department: 'Design',
            country: 'US',
            currency: 'USD',
            currentSalary: 85_000,
          }),
        ],
        total: 2,
      }),
    );

    renderWithProviders(<EmployeeListPage />);

    const ashaRow = await screen.findByRole('row', { name: /Asha Rao/ });
    expect(within(ashaRow).getByText('Software Engineer')).toBeInTheDocument();
    expect(within(ashaRow).getByText('Engineering')).toBeInTheDocument();
    expect(within(ashaRow).getByText('IN')).toBeInTheDocument();
    expect(within(ashaRow).getByText('INR 1,850,000')).toBeInTheDocument();
    const johnRow = screen.getByRole('row', { name: /John Miller/ });
    expect(within(johnRow).getByText('USD 85,000')).toBeInTheDocument();
  });

  it('shows the total number of employees', async () => {
    serveTwoPages();

    renderWithProviders(<EmployeeListPage />);

    expect(await screen.findByText('26 employees')).toBeInTheDocument();
  });

  it('shows "Page 1 of 2" with Previous disabled on the first page', async () => {
    serveTwoPages();

    renderWithProviders(<EmployeeListPage />);

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('requests the second page when Next is clicked and disables Next on the last page', async () => {
    const user = userEvent.setup();
    serveTwoPages();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Zed Young')).toBeInTheDocument();
    expect(listCalls().at(-1)).toContain('page=2');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('returns to the first page when Previous is clicked', async () => {
    const user = userEvent.setup();
    serveTwoPages();
    renderWithProviders(<EmployeeListPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findByText('Zed Young');

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('shows "No employees yet" when there are no employees', async () => {
    serveApi(() => aPage({ items: [], total: 0, totalPages: 1 }));

    renderWithProviders(<EmployeeListPage />);

    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a loading state while the first page is loading', () => {
    requestJsonMock.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<EmployeeListPage />);

    expect(screen.getByText('Loading employees')).toBeInTheDocument();
  });

  it('shows an error message with a retry button, and retrying loads the list', async () => {
    const user = userEvent.setup();
    let listRequests = 0;
    serveApi(() => {
      listRequests += 1;
      if (listRequests === 1) throw new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');
      return aPage();
    });
    renderWithProviders(<EmployeeListPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    await waitFor(() => expect(listRequests).toBe(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('EmployeeListPage search and filters', () => {
  /** Serves a result that depends on the request, so filtered and unfiltered lists differ. */
  function serveFiltered() {
    serveApi((path) => {
      const params = new URL(path, 'http://localhost').searchParams;
      const isFiltered = ['search', 'country', 'department', 'jobTitle'].some((key) =>
        params.has(key),
      );
      if (params.get('search') === 'nobody') return aPage({ items: [], total: 0 });
      if (isFiltered) {
        return aPage({ items: [anEmployee({ id: 2, fullName: 'Filtered Person' })], total: 1 });
      }
      return aPage({
        items: [anEmployee({ id: 1, fullName: 'Asha Rao' })],
        total: 26,
        totalPages: 2,
      });
    });
  }

  it('requests the typed search text after a pause, not on every keystroke', async () => {
    const user = userEvent.setup();
    serveFiltered();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');

    await user.type(screen.getByRole('textbox', { name: 'Search name' }), 'ana');

    expect(await screen.findByText('Filtered Person')).toBeInTheDocument();
    const searchRequests = listCalls().filter((path) => path.includes('search='));
    expect(searchRequests).toEqual(['/api/employees?search=ana&page=1']);
  });

  it('requests the chosen country, department and job title', async () => {
    const user = userEvent.setup();
    serveFiltered();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(screen.getByRole('option', { name: 'India' }));
    await user.click(screen.getByRole('combobox', { name: 'Department' }));
    await user.click(screen.getByRole('option', { name: 'Finance' }));
    await user.click(await screen.findByRole('combobox', { name: 'Job title' }));
    await user.click(await screen.findByRole('option', { name: 'Analyst' }));

    await waitFor(() => {
      const lastCall = new URL(listCalls().at(-1) ?? '', 'http://localhost').searchParams;
      expect(Object.fromEntries(lastCall)).toEqual({
        country: 'IN',
        department: 'Finance',
        jobTitle: 'Analyst',
        page: '1',
      });
    });
  });

  it('asks for the job title options of the employees in view', async () => {
    const user = userEvent.setup();
    serveFiltered();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(screen.getByRole('option', { name: 'India' }));

    await waitFor(() =>
      expect(requestJsonMock).toHaveBeenCalledWith('/api/employees/job-titles?country=IN'),
    );
  });

  it('returns to page 1 when a filter changes', async () => {
    const user = userEvent.setup();
    serveFiltered();
    renderWithProviders(<EmployeeListPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listCalls().at(-1)).toContain('page=2'));

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(screen.getByRole('option', { name: 'India' }));

    await waitFor(() => expect(listCalls().at(-1)).toBe('/api/employees?country=IN&page=1'));
  });

  it('returns to page 1 when the search text changes', async () => {
    const user = userEvent.setup();
    serveFiltered();
    renderWithProviders(<EmployeeListPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listCalls().at(-1)).toContain('page=2'));

    await user.type(screen.getByRole('textbox', { name: 'Search name' }), 'ana');

    await waitFor(() => expect(listCalls().at(-1)).toBe('/api/employees?search=ana&page=1'));
  });

  it('shows "No matching employees" when filters match nothing, instead of "No employees yet"', async () => {
    const user = userEvent.setup();
    serveFiltered();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');

    await user.type(screen.getByRole('textbox', { name: 'Search name' }), 'nobody');

    expect(await screen.findByText('No matching employees')).toBeInTheDocument();
    expect(screen.queryByText('No employees yet')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search name' })).toBeInTheDocument();
  });

  it('clears the search and every filter and shows the full list again', async () => {
    const user = userEvent.setup();
    serveFiltered();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');
    await user.type(screen.getByRole('textbox', { name: 'Search name' }), 'nobody');
    await screen.findByText('No matching employees');
    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(screen.getByRole('option', { name: 'India' }));

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search name' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent('All countries');
    expect(listCalls().at(-1)).toBe('/api/employees?page=1');
  });

  it('keeps the filters visible when the list fails to load', async () => {
    serveApi(() => {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');
    });

    renderWithProviders(<EmployeeListPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(await screen.findByRole('textbox', { name: 'Search name' })).toBeInTheDocument();
  });

  it('offers an "Add employee" link to the add form', async () => {
    serveApi(() => aPage());

    renderWithProviders(<EmployeeListPage />);

    expect(await screen.findByRole('link', { name: 'Add employee' })).toHaveAttribute(
      'href',
      '/employees/new',
    );
  });

  it('lists only inactive employees with an exit date column when "Show inactive employees" is on', async () => {
    serveApi((path) =>
      path.includes('status=inactive')
        ? aPage({
            items: [
              anEmployee({
                id: 9,
                fullName: 'Former Person',
                status: 'inactive',
                exitDate: '2025-06-30',
              }),
            ],
          })
        : aPage(),
    );
    const user = userEvent.setup();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');
    expect(screen.queryByRole('columnheader', { name: 'Exit date' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Show inactive employees' }));

    expect(await screen.findByText('Former Person')).toBeInTheDocument();
    expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Exit date' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2025-06-30' })).toBeInTheDocument();
    expect(listCalls().at(-1)).toBe('/api/employees?status=inactive&page=1');
  });

  it('goes back to page 1 when "Show inactive employees" is switched on', async () => {
    serveTwoPages();
    const user = userEvent.setup();
    renderWithProviders(<EmployeeListPage />);
    await screen.findByText('Asha Rao');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Zed Young');

    await user.click(screen.getByRole('switch', { name: 'Show inactive employees' }));

    await waitFor(() => expect(listCalls().at(-1)).toBe('/api/employees?status=inactive&page=1'));
  });

  it('keeps search and filters applied to the inactive list', async () => {
    serveApi(() => aPage());
    const user = userEvent.setup();
    renderWithProviders(<EmployeeListPage />);
    await user.type(await screen.findByLabelText('Search name'), 'ash');
    await waitFor(() => expect(listCalls().at(-1)).toContain('search=ash'));

    await user.click(screen.getByRole('switch', { name: 'Show inactive employees' }));

    await waitFor(() =>
      expect(listCalls().at(-1)).toBe('/api/employees?search=ash&status=inactive&page=1'),
    );
  });
});
