import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { ImportExportPage } from './ImportExportPage';

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
