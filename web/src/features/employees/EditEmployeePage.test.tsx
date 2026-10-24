import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail } from '@acme/contracts';
import { aReference } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';
import { ApiError, requestJson } from '@/api/http';
import { EditEmployeePage } from './EditEmployeePage';
import { EmployeeDetailPage } from './EmployeeDetailPage';

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  requestJson: vi.fn(),
}));

const requestJsonMock = vi.mocked(requestJson);

const employee: EmployeeDetail = {
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
  salaryHistory: [],
  linkedEmployments: [],
};

/** Serves reference data and the employee; `patchResult` decides the PATCH outcome. */
function serveApi(patchResult: () => EmployeeDetail | Promise<EmployeeDetail> = () => employee) {
  requestJsonMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/reference') return aReference();
    if (path === '/api/employees/7' && init?.method === 'PATCH') return patchResult();
    if (path === '/api/employees/7') return employee;
    if (path === '/api/employees/999')
      throw new ApiError(404, 'NOT_FOUND', 'Employee 999 not found');
    throw new Error(`Unexpected request ${path}`);
  });
}

function renderEditPage(id = '7') {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/:id/edit" element={<EditEmployeePage />} />
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
    </Routes>,
    { route: `/employees/${id}/edit` },
  );
}

function patchBodies() {
  return requestJsonMock.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

async function choose(user: UserEvent, field: RegExp, option: string) {
  await user.click(await screen.findByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('EditEmployeePage', () => {
  it('prefills the form with the employee values and leaves the new salary empty', async () => {
    serveApi();
    renderEditPage();

    expect(await screen.findByLabelText(/full name/i)).toHaveValue('Asha Rao');
    expect(screen.getByLabelText(/work email/i)).toHaveValue('asha.rao@acme.example');
    expect(screen.getByLabelText(/job title/i)).toHaveValue('Software Engineer');
    expect(screen.getByLabelText(/hire date/i)).toHaveValue('2024-03-01');
    expect(screen.getByRole('combobox', { name: /department/i })).toHaveTextContent('Engineering');
    expect(screen.getByRole('combobox', { name: /country/i })).toHaveTextContent('India');
    expect(screen.getByRole('combobox', { name: /employment type/i })).toHaveTextContent(
      'Full-time',
    );
    const pay = screen.getByRole('group', { name: 'Change salary' });
    expect(within(pay).getByLabelText(/new annual salary/i)).toHaveValue('');
    expect(within(pay).getByText('INR')).toBeInTheDocument();
  });

  it('shows the currency of the newly chosen country next to the new salary', async () => {
    serveApi();
    const user = userEvent.setup();
    renderEditPage();

    await choose(user, /country/i, 'Japan');

    const pay = screen.getByRole('group', { name: 'Change salary' });
    expect(within(pay).getByText('JPY')).toBeInTheDocument();
  });

  it('sends only the changed fields and opens the employee on success', async () => {
    serveApi();
    const user = userEvent.setup();
    renderEditPage();

    const title = await screen.findByLabelText(/job title/i);
    await user.clear(title);
    await user.type(title, 'Staff Engineer');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Asha Rao' })).toBeInTheDocument();
    expect(patchBodies()).toEqual([{ jobTitle: 'Staff Engineer' }]);
    expect(await screen.findByText(/employee updated/i)).toBeInTheDocument();
  });

  it('sends the typed amount as a salary change together with a changed country', async () => {
    serveApi();
    const user = userEvent.setup();
    renderEditPage();

    await choose(user, /country/i, 'Japan');
    await user.type(screen.getByLabelText(/new annual salary/i), '9500000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patchBodies()).toHaveLength(1));
    expect(patchBodies()[0]).toEqual({ country: 'JP', salaryChange: { amount: '9500000' } });
  });

  it('shows the salary error next to the new salary field', async () => {
    serveApi(() => {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Some fields are invalid', {
        'salaryChange.amount': 'Enter a new salary when the country changes',
      });
    });
    const user = userEvent.setup();
    renderEditPage();

    await choose(user, /country/i, 'Japan');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const amount = await screen.findByLabelText(/new annual salary/i);
    await waitFor(() => expect(amount).toHaveAttribute('aria-invalid', 'true'));
    expect(amount).toHaveAccessibleDescription('Enter a new salary when the country changes');
  });

  it('shows an email error when another active employee has the email', async () => {
    serveApi(() => {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An active employee already has this email');
    });
    const user = userEvent.setup();
    renderEditPage();

    const email = await screen.findByLabelText(/work email/i);
    await user.clear(email);
    await user.type(email, 'other@acme.example');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription(/already has this email/i);
  });

  it('shows "Employee not found" when the employee does not exist', async () => {
    serveApi();
    renderEditPage('999');

    expect(await screen.findByText('Employee not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('cancels back to the employee page', async () => {
    serveApi();
    renderEditPage();

    const cancel = await screen.findByRole('link', { name: 'Cancel' });

    expect(cancel).toHaveAttribute('href', '/employees/7');
  });
});
