import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeListPage as EmployeeListData, EmployeeSummary } from '@acme/contracts';
import { renderWithProviders } from '../../../test/render';
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

/** Serves a two-page list (26 employees) keyed by the `page` query parameter. */
function serveTwoPages() {
  requestJsonMock.mockImplementation(async (path: string) => {
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

beforeEach(() => requestJsonMock.mockReset());

describe('EmployeeListPage', () => {
  it('shows each employee with name, job title, department, country and formatted salary', async () => {
    requestJsonMock.mockResolvedValue(
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
    expect(requestJsonMock).toHaveBeenLastCalledWith(expect.stringContaining('page=2'));
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
    requestJsonMock.mockResolvedValue(aPage({ items: [], total: 0, totalPages: 1 }));

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
    requestJsonMock.mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong'),
    );
    requestJsonMock.mockResolvedValueOnce(aPage());
    renderWithProviders(<EmployeeListPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    await waitFor(() => expect(requestJsonMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
