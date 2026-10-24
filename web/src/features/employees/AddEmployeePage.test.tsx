import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail } from '@acme/contracts';
import { aReference } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';
import { ApiError, requestJson } from '@/api/http';
import { AddEmployeePage } from './AddEmployeePage';
import { EmployeeDetailPage } from './EmployeeDetailPage';

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  requestJson: vi.fn(),
}));

const requestJsonMock = vi.mocked(requestJson);

function aDetail(overrides: Partial<EmployeeDetail> = {}): EmployeeDetail {
  return {
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
    ...overrides,
  };
}

/** Serves the reference data and the created employee; `createResult` decides the POST outcome. */
function serveApi(createResult: () => EmployeeDetail | Promise<EmployeeDetail>) {
  requestJsonMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/reference') return aReference();
    if (path === '/api/employees' && init?.method === 'POST') return createResult();
    if (path === '/api/employees/7') return aDetail();
    throw new Error(`Unexpected request ${path}`);
  });
}

function renderAddPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/new" element={<AddEmployeePage />} />
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
    </Routes>,
    { route: '/employees/new' },
  );
}

async function choose(user: UserEvent, field: RegExp, option: string) {
  await user.click(await screen.findByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function fillValidForm(user: UserEvent) {
  await user.type(await screen.findByLabelText(/full name/i), '  Asha Rao ');
  await user.type(screen.getByLabelText(/work email/i), 'Asha.Rao@acme.example');
  await user.type(screen.getByLabelText(/job title/i), 'Software Engineer');
  await choose(user, /department/i, 'Engineering');
  await choose(user, /country/i, 'India');
  await user.type(screen.getByLabelText(/annual salary/i), '1850000');
  await choose(user, /employment type/i, 'Full-time');
  await user.type(screen.getByLabelText(/hire date/i), '2024-03-01');
}

function postCalls() {
  return requestJsonMock.mock.calls.filter(([, init]) => init?.method === 'POST');
}

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('AddEmployeePage', () => {
  it('shows the currency of the chosen country next to the salary, as read-only text', async () => {
    serveApi(() => aDetail());
    const user = userEvent.setup();
    renderAddPage();

    await choose(user, /country/i, 'Japan');

    const currency = screen.getByText('JPY');
    expect(currency).toBeInTheDocument();
    expect(currency.closest('input, textarea, select')).toBeNull();
    expect(screen.queryByRole('textbox', { name: /currency/i })).not.toBeInTheDocument();
  });

  it('limits the hire date to the server date', async () => {
    serveApi(() => aDetail());
    renderAddPage();

    expect(await screen.findByLabelText(/hire date/i)).toHaveAttribute('max', '2026-10-24');
  });

  it('sends what was typed and opens the new employee on success', async () => {
    serveApi(() => aDetail());
    const user = userEvent.setup();
    renderAddPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Asha Rao' })).toBeInTheDocument();
    const [, init] = postCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      fullName: '  Asha Rao ',
      email: 'Asha.Rao@acme.example',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      country: 'IN',
      annualSalary: '1850000',
      employmentType: 'Full-time',
      hireDate: '2024-03-01',
    });
    expect(await screen.findByText(/employee added/i)).toBeInTheDocument();
  });

  it('shows the server field errors as text next to each field, with no client-side rules', async () => {
    serveApi(() => {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Some fields are invalid', {
        fullName: 'Full name is required',
        annualSalary: 'Annual salary is required',
      });
    });
    const user = userEvent.setup();
    renderAddPage();

    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Full name is required')).toBeInTheDocument();
    expect(screen.getByText('Annual salary is required')).toBeInTheDocument();
    const fullName = screen.getByLabelText(/full name/i);
    expect(fullName).toHaveAttribute('aria-invalid', 'true');
    expect(fullName).toHaveAccessibleDescription('Full name is required');
    expect(postCalls()).toHaveLength(1);
  });

  it('shows an email error when an active employee already has the email', async () => {
    serveApi(() => {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An active employee already has this email');
    });
    const user = userEvent.setup();
    renderAddPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const email = screen.getByLabelText(/work email/i);
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription(/already has this email/i);
    expect(screen.queryByRole('heading', { level: 1, name: 'Asha Rao' })).not.toBeInTheDocument();
  });

  it('labels every field and groups them under Identity, Role and Pay', async () => {
    serveApi(() => aDetail());
    renderAddPage();

    await screen.findByLabelText(/full name/i);
    for (const group of ['Identity', 'Role', 'Pay']) {
      expect(screen.getByRole('group', { name: group })).toBeInTheDocument();
    }
    const pay = screen.getByRole('group', { name: 'Pay' });
    expect(within(pay).getByLabelText(/annual salary/i)).toBeInTheDocument();
  });
});
