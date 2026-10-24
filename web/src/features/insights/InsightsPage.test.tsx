import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CountryInsight, CountryInsights, CountryJobTitleInsights } from '@acme/contracts';
import { aReference } from '../../../test/fixtures';
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

  describe('job-title insights', () => {
    function aJobTitleInsights(
      overrides: Partial<CountryJobTitleInsights> = {},
    ): CountryJobTitleInsights {
      return {
        country: 'IN',
        countryName: 'India',
        currency: 'INR',
        jobTitles: [
          {
            jobTitle: 'Analyst',
            headcount: 3,
            min: 1_000_000,
            max: 3_000_000,
            mean: 2_000_000,
            median: 2_000_000,
          },
          {
            jobTitle: 'Designer',
            headcount: 1,
            min: 900_000,
            max: 900_000,
            mean: 900_000,
            median: 900_000,
          },
        ],
        ...overrides,
      };
    }

    function serveApi(jobTitlesByCountry: Record<string, CountryJobTitleInsights>) {
      requestJsonMock.mockImplementation((url: string) => {
        if (url === '/api/insights/countries') {
          return Promise.resolve({
            countries: [
              aCountryInsight(),
              aCountryInsight({ country: 'US', countryName: 'United States', currency: 'USD' }),
            ],
          });
        }
        if (url === '/api/reference') return Promise.resolve(aReference());
        const match = /^\/api\/insights\/countries\/(\w+)\/job-titles$/.exec(url);
        if (match?.[1] && jobTitlesByCountry[match[1]]) {
          return Promise.resolve(jobTitlesByCountry[match[1]]);
        }
        return Promise.reject(new Error(`Unexpected ${url}`));
      });
    }

    it('shows the job titles of the country picked from its row', async () => {
      serveApi({ IN: aJobTitleInsights() });
      const user = userEvent.setup();
      renderWithProviders(<InsightsPage />);

      await user.click(await screen.findByRole('button', { name: 'View job titles for India' }));

      const analystRow = await screen.findByRole('row', { name: /Analyst/ });
      expect(within(analystRow).getByText('3')).toBeInTheDocument();
      expect(within(analystRow).getByText('INR 1,000,000')).toBeInTheDocument();
      expect(within(analystRow).getByText('INR 3,000,000')).toBeInTheDocument();
      expect(screen.getByRole('row', { name: /Designer/ })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent('India');
      expect(requestJsonMock).toHaveBeenCalledWith('/api/insights/countries/IN/job-titles');
    });

    it('defaults to the first country A to Z when the tab is opened directly', async () => {
      serveApi({
        AU: aJobTitleInsights({ country: 'AU', countryName: 'Australia', currency: 'AUD' }),
      });
      const user = userEvent.setup();
      renderWithProviders(<InsightsPage />);

      await user.click(screen.getByRole('tab', { name: 'By job title' }));

      expect(await screen.findByRole('row', { name: /Analyst/ })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent('Australia');
    });

    it('switches to another country chosen from the selector', async () => {
      serveApi({
        IN: aJobTitleInsights(),
        US: aJobTitleInsights({
          country: 'US',
          countryName: 'United States',
          currency: 'USD',
          jobTitles: [
            {
              jobTitle: 'Accountant',
              headcount: 2,
              min: 50_000,
              max: 70_000,
              mean: 60_000,
              median: 60_000,
            },
          ],
        }),
      });
      const user = userEvent.setup();
      renderWithProviders(<InsightsPage />);
      await user.click(await screen.findByRole('button', { name: 'View job titles for India' }));
      await screen.findByRole('row', { name: /Analyst/ });

      await user.click(screen.getByRole('combobox', { name: 'Country' }));
      await user.click(await screen.findByRole('option', { name: 'United States' }));

      const accountantRow = await screen.findByRole('row', { name: /Accountant/ });
      expect(within(accountantRow).getByText('USD 70,000')).toBeInTheDocument();
      expect(screen.queryByRole('row', { name: /Analyst/ })).not.toBeInTheDocument();
    });

    it('shows "No employees in this country" when the country has no active employees', async () => {
      serveApi({ IN: aJobTitleInsights({ jobTitles: [] }) });
      const user = userEvent.setup();
      renderWithProviders(<InsightsPage />);

      await user.click(await screen.findByRole('button', { name: 'View job titles for India' }));

      expect(await screen.findByText('No employees in this country')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });
});
