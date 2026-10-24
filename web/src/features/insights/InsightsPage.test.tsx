import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CountryInsight, CountryInsights } from '@acme/contracts';
import { renderWithProviders } from '../../../test/render';
import { ApiError, requestJson } from '@/api/http';
import { InsightsPage } from './InsightsPage';

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  requestJson: vi.fn(),
}));

const requestJsonMock = vi.mocked(requestJson);

function aCountryInsight(overrides: Partial<CountryInsight> = {}): CountryInsight {
  return {
    country: 'IN',
    countryName: 'India',
    currency: 'INR',
    headcount: 4,
    min: 1_000_000,
    max: 3_000_000,
    mean: 2_000_001,
    median: 1_850_000,
    ...overrides,
  };
}

function serveCountries(data: CountryInsights) {
  requestJsonMock.mockResolvedValue(data);
}

describe('InsightsPage', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
  });

  it('shows each country with its headcount and formatted figures', async () => {
    serveCountries({
      countries: [
        aCountryInsight(),
        aCountryInsight({
          country: 'US',
          countryName: 'United States',
          currency: 'USD',
          headcount: 2,
          min: 60_000,
          max: 130_000,
          mean: 95_000,
          median: 95_000,
        }),
      ],
    });

    renderWithProviders(<InsightsPage />);

    const indiaRow = (await screen.findByRole('row', { name: /India/ })) as HTMLElement;
    expect(within(indiaRow).getByText('4')).toBeInTheDocument();
    expect(within(indiaRow).getByText('INR 1,000,000')).toBeInTheDocument();
    expect(within(indiaRow).getByText('INR 3,000,000')).toBeInTheDocument();
    expect(within(indiaRow).getByText('INR 2,000,001')).toBeInTheDocument();
    expect(within(indiaRow).getByText('INR 1,850,000')).toBeInTheDocument();
    const usRow = screen.getByRole('row', { name: /United States/ });
    expect(within(usRow).getByText('USD 130,000')).toBeInTheDocument();
    expect(requestJsonMock).toHaveBeenCalledWith('/api/insights/countries');
  });

  it('right-aligns the headcount and amount columns', async () => {
    serveCountries({ countries: [aCountryInsight()] });

    renderWithProviders(<InsightsPage />);

    const median = await screen.findByText('INR 1,850,000');
    expect(median).toHaveClass('text-right');
    expect(screen.getByRole('columnheader', { name: 'Median' })).toHaveClass('text-right');
  });

  it('shows "No employees yet" when there are no active employees', async () => {
    serveCountries({ countries: [] });

    renderWithProviders(<InsightsPage />);

    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('offers the three insight tabs with the country tab first', async () => {
    serveCountries({ countries: [] });

    renderWithProviders(<InsightsPage />);

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'By country',
      'By job title',
      'Organisation (USD)',
    ]);
    expect(screen.getByRole('tab', { name: 'By country' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('moves to the job-title tab when "View job titles" is chosen for a country', async () => {
    serveCountries({ countries: [aCountryInsight()] });
    const user = userEvent.setup();
    renderWithProviders(<InsightsPage />);

    await user.click(await screen.findByRole('button', { name: 'View job titles for India' }));

    expect(screen.getByRole('tab', { name: 'By job title' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows a retryable error when the figures cannot be loaded', async () => {
    requestJsonMock.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Boom'));
    serveCountries({ countries: [aCountryInsight()] });
    const user = userEvent.setup();
    renderWithProviders(<InsightsPage />);

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('row', { name: /India/ })).toBeInTheDocument();
  });
});
