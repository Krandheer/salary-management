import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportPreview, ImportResult } from '@acme/contracts';
import { renderWithProviders } from '../../../test/render';
import { ApiError, requestJson } from '@/api/http';
import { ImportExportPage } from './ImportExportPage';

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  requestJson: vi.fn(),
}));

const requestJsonMock = vi.mocked(requestJson);

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const preview: ImportPreview = {
  totals: { create: 1, update: 0, unchanged: 4, error: 0 },
  creates: [{ row: 2, email: 'new@acme.example', rehireOf: null }],
  updates: [],
  errors: [],
};

function anXlsxFile(name = 'employees.xlsx'): File {
  return new File(['xlsx bytes'], name, { type: XLSX_TYPE });
}

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe('ImportExportPage', () => {
  it('links "Download template" to the import template endpoint', () => {
    renderWithProviders(<ImportExportPage />);

    expect(screen.getByRole('link', { name: /Download template/ })).toHaveAttribute(
      'href',
      '/api/imports/template',
    );
  });

  it('links "Export current list" to the employee export endpoint', () => {
    renderWithProviders(<ImportExportPage />);

    expect(screen.getByRole('link', { name: /Export current list/ })).toHaveAttribute(
      'href',
      '/api/exports/employees',
    );
  });

  it('has a heading for the page', () => {
    renderWithProviders(<ImportExportPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Import / Export' })).toBeInTheDocument();
  });
});

describe('ImportExportPage: import preview', () => {
  it('keeps "Preview import" disabled until a file is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportExportPage />);

    const previewButton = screen.getByRole('button', { name: 'Preview import' });
    expect(previewButton).toBeDisabled();

    await user.upload(screen.getByLabelText('Excel file (.xlsx)'), anXlsxFile());

    expect(previewButton).toBeEnabled();
  });

  it('only offers .xlsx files in the file picker', () => {
    renderWithProviders(<ImportExportPage />);

    expect(screen.getByLabelText('Excel file (.xlsx)')).toHaveAttribute('accept', '.xlsx');
  });

  it('uploads the chosen file as multipart form data and shows the preview', async () => {
    const user = userEvent.setup();
    requestJsonMock.mockResolvedValue(preview);
    renderWithProviders(<ImportExportPage />);
    const file = anXlsxFile();

    await user.upload(screen.getByLabelText('Excel file (.xlsx)'), file);
    await user.click(screen.getByRole('button', { name: 'Preview import' }));

    const totals = await screen.findByRole('list', { name: 'Import totals' });
    expect(within(totals).getAllByRole('listitem')[0]).toHaveTextContent('Create 1');
    const [path, init] = requestJsonMock.mock.calls[0]!;
    expect(path).toBe('/api/imports/preview');
    expect(init?.method).toBe('POST');
    expect((init?.body as FormData).get('file')).toBe(file);
    expect(init?.headers).toBeUndefined();
  });

  it('shows the server message when the whole file is rejected', async () => {
    const user = userEvent.setup();
    requestJsonMock.mockRejectedValue(
      new ApiError(400, 'HEADER_MISMATCH', 'The header row must match the template columns'),
    );
    renderWithProviders(<ImportExportPage />);

    await user.upload(screen.getByLabelText('Excel file (.xlsx)'), anXlsxFile());
    await user.click(screen.getByRole('button', { name: 'Preview import' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The header row must match the template columns',
    );
    expect(screen.queryByRole('list', { name: 'Import totals' })).not.toBeInTheDocument();
  });

  it('clears the previous preview when another file is chosen', async () => {
    const user = userEvent.setup();
    requestJsonMock.mockResolvedValue(preview);
    renderWithProviders(<ImportExportPage />);
    const input = screen.getByLabelText('Excel file (.xlsx)');

    await user.upload(input, anXlsxFile());
    await user.click(screen.getByRole('button', { name: 'Preview import' }));
    await screen.findByRole('list', { name: 'Import totals' });
    await user.upload(input, anXlsxFile('other.xlsx'));

    expect(screen.queryByRole('list', { name: 'Import totals' })).not.toBeInTheDocument();
  });
});

const IMPORT_PATH = '/api/imports';

const rejectedPreview: ImportPreview = {
  totals: { create: 0, update: 0, unchanged: 4, error: 1 },
  creates: [],
  updates: [],
  errors: [
    {
      row: 2,
      email: 'new@acme.example',
      messages: [
        'Hire Date: Hire date cannot be later than the earliest salary entry (2020-01-15)',
      ],
    },
  ],
};

/** Previews succeed with `preview`; confirming settles with `confirmOutcome`. */
function serveImport(confirmOutcome: () => Promise<unknown>) {
  requestJsonMock.mockImplementation((path) =>
    path === '/api/imports/preview' ? Promise.resolve(preview) : confirmOutcome(),
  );
}

async function previewThenConfirm(user: UserEvent, file = anXlsxFile()): Promise<void> {
  await user.upload(screen.getByLabelText('Excel file (.xlsx)'), file);
  await user.click(screen.getByRole('button', { name: 'Preview import' }));
  await user.click(await screen.findByRole('button', { name: 'Confirm import' }));
}

describe('ImportExportPage: confirming an import', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the same file to the import endpoint and shows how many employees were created, updated and unchanged', async () => {
    const user = userEvent.setup();
    const result: ImportResult = { created: 1, updated: 2, unchanged: 4 };
    serveImport(() => Promise.resolve(result));
    renderWithProviders(<ImportExportPage />);
    const file = anXlsxFile();

    await previewThenConfirm(user, file);

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Import complete');
    expect(summary).toHaveTextContent('1 created, 2 updated, 4 left unchanged');
    const [path, init] = requestJsonMock.mock.calls[1]!;
    expect(path).toBe(IMPORT_PATH);
    expect(init?.method).toBe('POST');
    expect((init?.body as FormData).get('file')).toBe(file);
    expect(screen.queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument();
  });

  it('refreshes employee and insight data after the import is saved', async () => {
    const user = userEvent.setup();
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    serveImport(() => Promise.resolve({ created: 1, updated: 0, unchanged: 4 }));
    renderWithProviders(<ImportExportPage />);

    await previewThenConfirm(user);
    await screen.findByText('Import complete');

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['employees'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['insights'] });
  });

  it('replaces the preview with the new one and explains that the data changed when the import is rejected', async () => {
    const user = userEvent.setup();
    serveImport(() =>
      Promise.reject(
        new ApiError(422, 'IMPORT_REJECTED', 'The import has rows with errors', undefined, {
          error: {
            code: 'IMPORT_REJECTED',
            message: 'The import has rows with errors',
            preview: rejectedPreview,
          },
        }),
      ),
    );
    renderWithProviders(<ImportExportPage />);

    await previewThenConfirm(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The data changed since the preview',
    );
    const totals = screen.getByRole('list', { name: 'Import totals' });
    expect(within(totals).getAllByRole('listitem')[3]).toHaveTextContent('Errors 1');
    expect(
      screen.getByText(
        'Hire Date: Hire date cannot be later than the earliest salary entry (2020-01-15)',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  });

  it('says the import was not applied when saving fails', async () => {
    const user = userEvent.setup();
    serveImport(() =>
      Promise.reject(
        new ApiError(
          500,
          'IMPORT_NOT_APPLIED',
          'The import could not be applied; no changes were made',
        ),
      ),
    );
    renderWithProviders(<ImportExportPage />);

    await previewThenConfirm(user);

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('The import was not applied');
    expect(failure).toHaveTextContent('The import could not be applied; no changes were made');
  });
});
