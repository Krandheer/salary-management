import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportPreview } from '@acme/contracts';
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
