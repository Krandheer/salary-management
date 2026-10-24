import type { ReferenceData } from '@acme/contracts';

export function aReference(): ReferenceData {
  return {
    countries: [
      { code: 'AU', name: 'Australia', currency: 'AUD', maxAnnualSalary: 75_000_000 },
      { code: 'CA', name: 'Canada', currency: 'CAD', maxAnnualSalary: 70_000_000 },
      { code: 'DE', name: 'Germany', currency: 'EUR', maxAnnualSalary: 45_000_000 },
      { code: 'IN', name: 'India', currency: 'INR', maxAnnualSalary: 4_000_000_000 },
      { code: 'JP', name: 'Japan', currency: 'JPY', maxAnnualSalary: 7_500_000_000 },
      { code: 'SG', name: 'Singapore', currency: 'SGD', maxAnnualSalary: 65_000_000 },
      { code: 'GB', name: 'United Kingdom', currency: 'GBP', maxAnnualSalary: 40_000_000 },
      { code: 'US', name: 'United States', currency: 'USD', maxAnnualSalary: 50_000_000 },
    ],
    departments: [
      'Customer Support',
      'Design',
      'Engineering',
      'Finance',
      'Human Resources',
      'Legal',
      'Marketing',
      'Operations',
      'Product',
      'Sales',
    ],
    employmentTypes: ['Full-time', 'Part-time', 'Contractor'],
    exchangeRates: {
      asOf: '2026-10-23',
      source: 'https://example.test/rates',
      toUsd: {
        USD: 1,
        EUR: 1.1193,
        GBP: 1.3,
        CAD: 0.7,
        AUD: 0.7,
        SGD: 0.78,
        INR: 0.0105,
        JPY: 0.0064,
      },
    },
    today: '2026-10-24',
  };
}
