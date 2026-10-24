import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail } from '@acme/contracts';
import { renderWithProviders } from '../../../test/render';
import { ApiError, requestJson } from '@/api/http';
import { DeleteEmployeeDialog } from './DeleteEmployeeDialog';

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

function renderDialog() {
  const onOpenChange = vi.fn();
  const onDeleted = vi.fn();
  renderWithProviders(
    <DeleteEmployeeDialog
      employee={employee}
      today="2026-10-24"
      open
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />,
  );
  return { onOpenChange, onDeleted };
}

function deleteCalls() {
  return requestJsonMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
}

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('DeleteEmployeeDialog', () => {
  it('asks for confirmation and explains that the record is kept as inactive', async () => {
    renderDialog();

    expect(
      await screen.findByRole('alertdialog', { name: /delete asha rao/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/kept as inactive/i)).toBeInTheDocument();
  });

  it('defaults the exit date to today and limits it to the hire date through today', async () => {
    renderDialog();

    const exitDate = await screen.findByLabelText('Exit date');
    expect(exitDate).toHaveValue('2026-10-24');
    expect(exitDate).toHaveAttribute('min', '2024-03-01');
    expect(exitDate).toHaveAttribute('max', '2026-10-24');
  });

  it('puts keyboard focus on Cancel, not on the destructive action', async () => {
    renderDialog();

    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it('leaves the employee untouched when cancelled', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onDeleted } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it('deletes with the chosen exit date and reports the deletion', async () => {
    requestJsonMock.mockResolvedValue({ ...employee, status: 'inactive', exitDate: '2026-09-30' });
    const user = userEvent.setup();
    const { onDeleted } = renderDialog();

    const exitDate = await screen.findByLabelText('Exit date');
    await user.clear(exitDate);
    await user.type(exitDate, '2026-09-30');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteCalls()).toEqual([['/api/employees/7?exitDate=2026-09-30', { method: 'DELETE' }]]);
  });

  it('shows the server error next to the exit date and stays open', async () => {
    requestJsonMock.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'Some fields are invalid', {
        exitDate: 'Exit date cannot be before the hire date',
      }),
    );
    const user = userEvent.setup();
    const { onDeleted, onOpenChange } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    const exitDate = screen.getByLabelText('Exit date');
    expect(await screen.findByText('Exit date cannot be before the hire date')).toBeInTheDocument();
    expect(exitDate).toHaveAttribute('aria-invalid', 'true');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('shows a persistent error when the employee is already inactive', async () => {
    requestJsonMock.mockRejectedValue(
      new ApiError(409, 'EMPLOYEE_INACTIVE', 'This employee is inactive and cannot be changed'),
    );
    const user = userEvent.setup();
    const { onDeleted } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/inactive and cannot be changed/i)).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
