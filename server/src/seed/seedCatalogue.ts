import type { CountryCode } from '@acme/contracts';

export interface JobProfile {
  title: string;
  /** US-baseline annual salary band in USD. */
  usdMin: number;
  usdMax: number;
}

export const SEED_RANDOM_SEED = 20261024;
export const SEED_EMPLOYEE_COUNT = 10_000;

export const JOB_CATALOGUE: Readonly<Record<string, readonly JobProfile[]>> = {
  'Customer Support': [
    { title: 'Support Specialist', usdMin: 40_000, usdMax: 65_000 },
    { title: 'Senior Support Specialist', usdMin: 60_000, usdMax: 85_000 },
    { title: 'Support Team Lead', usdMin: 75_000, usdMax: 105_000 },
    { title: 'Customer Success Manager', usdMin: 85_000, usdMax: 125_000 },
  ],
  Design: [
    { title: 'Product Designer', usdMin: 85_000, usdMax: 130_000 },
    { title: 'Senior Product Designer', usdMin: 120_000, usdMax: 170_000 },
    { title: 'UX Researcher', usdMin: 90_000, usdMax: 135_000 },
    { title: 'Design Manager', usdMin: 150_000, usdMax: 210_000 },
  ],
  Engineering: [
    { title: 'Software Engineer', usdMin: 95_000, usdMax: 160_000 },
    { title: 'Senior Software Engineer', usdMin: 140_000, usdMax: 210_000 },
    { title: 'Engineering Manager', usdMin: 170_000, usdMax: 250_000 },
    { title: 'QA Engineer', usdMin: 70_000, usdMax: 115_000 },
    { title: 'DevOps Engineer', usdMin: 105_000, usdMax: 165_000 },
  ],
  Finance: [
    { title: 'Financial Analyst', usdMin: 70_000, usdMax: 110_000 },
    { title: 'Senior Accountant', usdMin: 80_000, usdMax: 120_000 },
    { title: 'Finance Manager', usdMin: 125_000, usdMax: 180_000 },
  ],
  'Human Resources': [
    { title: 'HR Generalist', usdMin: 60_000, usdMax: 90_000 },
    { title: 'Recruiter', usdMin: 65_000, usdMax: 100_000 },
    { title: 'HR Business Partner', usdMin: 95_000, usdMax: 140_000 },
  ],
  Legal: [
    { title: 'Paralegal', usdMin: 55_000, usdMax: 85_000 },
    { title: 'Corporate Counsel', usdMin: 140_000, usdMax: 220_000 },
    { title: 'Compliance Officer', usdMin: 90_000, usdMax: 145_000 },
  ],
  Marketing: [
    { title: 'Marketing Specialist', usdMin: 60_000, usdMax: 95_000 },
    { title: 'Content Strategist', usdMin: 70_000, usdMax: 110_000 },
    { title: 'Growth Marketing Manager', usdMin: 105_000, usdMax: 155_000 },
    { title: 'Brand Manager', usdMin: 100_000, usdMax: 150_000 },
  ],
  Operations: [
    { title: 'Operations Analyst', usdMin: 60_000, usdMax: 95_000 },
    { title: 'Logistics Coordinator', usdMin: 50_000, usdMax: 80_000 },
    { title: 'Operations Manager', usdMin: 110_000, usdMax: 165_000 },
  ],
  Product: [
    { title: 'Product Manager', usdMin: 115_000, usdMax: 175_000 },
    { title: 'Senior Product Manager', usdMin: 155_000, usdMax: 220_000 },
    { title: 'Product Analyst', usdMin: 80_000, usdMax: 120_000 },
    { title: 'Director of Product', usdMin: 190_000, usdMax: 280_000 },
  ],
  Sales: [
    { title: 'Sales Development Representative', usdMin: 50_000, usdMax: 80_000 },
    { title: 'Account Executive', usdMin: 80_000, usdMax: 140_000 },
    { title: 'Senior Account Executive', usdMin: 120_000, usdMax: 190_000 },
    { title: 'Sales Manager', usdMin: 130_000, usdMax: 200_000 },
    { title: 'Solutions Engineer', usdMin: 105_000, usdMax: 165_000 },
  ],
};

export const COUNTRY_WEIGHTS: Readonly<Record<CountryCode, number>> = {
  US: 0.3,
  IN: 0.2,
  GB: 0.12,
  DE: 0.1,
  CA: 0.08,
  AU: 0.07,
  SG: 0.07,
  JP: 0.06,
};

export const COUNTRY_PAY_FACTORS: Readonly<Record<CountryCode, number>> = {
  US: 1.0,
  GB: 0.75,
  DE: 0.8,
  CA: 0.8,
  AU: 0.85,
  SG: 0.8,
  JP: 0.7,
  IN: 0.25,
};
