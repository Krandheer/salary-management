import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail } from '@acme/contracts';
import { aReference } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';
import { ApiError, requestJson } from '@/api/http';
import { EmployeeDetailPage } from './EmployeeDetailPage';

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  requestJson: vi.fn(),
}));

const requestJsonMock = vi.mocked(requestJson);

const detail: EmployeeDetail = {
  id: 7,
  fullName: 'Asha Rao',
  email: 'asha.rao@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  currency: 'INR',
  currentSalary: 1_850_000,
  employmentType: 'Full-time',
  hireDate: '2024-03-01',
  status: 'active',
  exitDate: null,
  salaryHistory: [
    {
      id: 1,
      amount: 1_850_000,
      currency: 'INR',
      effectiveDate: '2024-03-01',
      reason: 'Starting salary',
      recordedAt: '2026-10-24T00:00:00.000Z',
    },
  ],
  linkedEmployments: [],
};

function renderDetail(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
    </Routes>,
    { route: `/employees/${id}` },
  );
}

/** Serves the reference data and the employee detail from `serveDetail`. */
function serveApi(serveDetail: () => EmployeeDetail) {
  requestJsonMock.mockImplementation(async (path: string) => {
    if (path === '/api/reference') return aReference();
    return serveDetail();
  });
}

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('EmployeeDetailPage', () => {
  it('shows the employee details and the starting salary entry', async () => {
    serveApi(() => detail);

    renderDetail('7');

    expect(await screen.findByRole('heading', { level: 1, name: 'Asha Rao' })).toBeInTheDocument();
    expect(screen.getByText('asha.rao@acme.example')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getAllByText('INR 1,850,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Starting salary')).toBeInTheDocument();
    expect(screen.getByText('2024-03-01', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows the employee id, country, currency and current salary', async () => {
    serveApi(() => detail);

    renderDetail('7');

    await screen.findByRole('heading', { level: 1, name: 'Asha Rao' });
    expect(screen.getByText('Employee ID').nextElementSibling).toHaveTextContent('7');
    expect(screen.getByText('Country').nextElementSibling).toHaveTextContent('India');
    expect(screen.getByText('Currency').nextElementSibling).toHaveTextContent('INR');
    expect(screen.getByText('Current salary').nextElementSibling).toHaveTextContent(
      'INR 1,850,000',
    );
  });

  it('marks the newest salary entry as current', async () => {
    serveApi(() => ({
      ...detail,
      currentSalary: 2_000_000,
      salaryHistory: [
        { ...detail.salaryHistory[0]!, id: 2, amount: 2_000_000, effectiveDate: '2025-01-01' },
        ...detail.salaryHistory,
      ],
    }));

    renderDetail('7');

    await screen.findByRole('heading', { level: 1, name: 'Asha Rao' });
    expect(screen.getAllByText('Current')).toHaveLength(1);
    expect(screen.getByText('Current').closest('tr')).toHaveTextContent('2025-01-01');
  });

  it('links to the edit page', async () => {
    serveApi(() => detail);

    renderDetail('7');

    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/employees/7/edit',
    );
  });

  it('shows a not-found message when the employee does not exist', async () => {
    requestJsonMock.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Employee not found'));

    renderDetail('999');

    expect(await screen.findByText('Employee not found')).toBeInTheDocument();
  });

  it('offers Edit and Delete for an active employee', async () => {
    serveApi(() => detail);

    renderDetail('7');

    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('asks for confirmation before deleting and shows the employee as inactive afterwards', async () => {
    let current = detail;
    requestJsonMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/reference') return aReference();
      if (init?.method === 'DELETE') {
        current = { ...detail, status: 'inactive', exitDate: '2026-10-24' };
        return current;
      }
      return current;
    });
    const user = userEvent.setup();
    renderDetail('7');

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(requestJsonMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows an inactive employee with the exit date, details and history, and no Edit or Delete', async () => {
    serveApi(() => ({ ...detail, status: 'inactive', exitDate: '2025-06-30' }));

    renderDetail('7');

    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Exit date').nextElementSibling).toHaveTextContent('2025-06-30');
    expect(screen.getByText('asha.rao@acme.example')).toBeInTheDocument();
    expect(screen.getByText('Starting salary')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('lists linked employment records with id, hire date, exit date, status and a link to open each', async () => {
    serveApi(() => ({
      ...detail,
      linkedEmployments: [
        { id: 3, hireDate: '2020-01-15', exitDate: '2023-12-31', status: 'inactive' },
        { id: 2, hireDate: '2015-05-01', exitDate: '2019-05-01', status: 'inactive' },
      ],
    }));

    renderDetail('7');

    await screen.findByRole('heading', { level: 1, name: 'Asha Rao' });
    expect(screen.getByRole('heading', { name: 'Linked employment records' })).toBeInTheDocument();
    const row = screen.getByRole('link', { name: 'Open employee 3' }).closest('tr');
    expect(row).toHaveTextContent('3');
    expect(row).toHaveTextContent('2020-01-15');
    expect(row).toHaveTextContent('2023-12-31');
    expect(row).toHaveTextContent('Inactive');
    expect(screen.getByRole('link', { name: 'Open employee 3' })).toHaveAttribute(
      'href',
      '/employees/3',
    );
    expect(screen.getByRole('link', { name: 'Open employee 2' })).toHaveAttribute(
      'href',
      '/employees/2',
    );
  });

  it('omits the linked employment section when there are none', async () => {
    serveApi(() => detail);

    renderDetail('7');

    await screen.findByRole('heading', { level: 1, name: 'Asha Rao' });
    expect(screen.queryByText('Linked employment records')).not.toBeInTheDocument();
  });
});
