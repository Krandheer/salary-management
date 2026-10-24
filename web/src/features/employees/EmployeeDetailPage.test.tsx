import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail } from '@acme/contracts';
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

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('EmployeeDetailPage', () => {
  it('shows the employee details and the starting salary entry', async () => {
    requestJsonMock.mockResolvedValue(detail);

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
    requestJsonMock.mockResolvedValue(detail);

    renderDetail('7');

    await screen.findByRole('heading', { level: 1, name: 'Asha Rao' });
    expect(screen.getByText('Employee ID').nextElementSibling).toHaveTextContent('7');
    expect(screen.getByText('Country').nextElementSibling).toHaveTextContent('IN');
    expect(screen.getByText('Currency').nextElementSibling).toHaveTextContent('INR');
    expect(screen.getByText('Current salary').nextElementSibling).toHaveTextContent(
      'INR 1,850,000',
    );
  });

  it('links to the edit page', async () => {
    requestJsonMock.mockResolvedValue(detail);

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
});
