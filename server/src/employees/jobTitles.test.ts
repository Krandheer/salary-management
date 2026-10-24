import { describe, expect, it } from 'vitest';
import { compareTitles, pickDisplayTitle } from './jobTitles.ts';

describe('pickDisplayTitle', () => {
  it('picks the spelling used most often', () => {
    expect(pickDisplayTitle(['software engineer', 'Software Engineer', 'Software Engineer'])).toBe(
      'Software Engineer',
    );
  });

  it('picks the first spelling A to Z when spellings are tied', () => {
    expect(pickDisplayTitle(['software engineer', 'Software Engineer'])).toBe('software engineer');
  });

  it('counts spellings that differ only by surrounding spaces as one spelling', () => {
    expect(pickDisplayTitle([' Designer', 'Designer ', 'DESIGNER'])).toBe('Designer');
  });

  it('returns the trimmed title', () => {
    expect(pickDisplayTitle(['  Analyst  '])).toBe('Analyst');
  });
});

describe('compareTitles', () => {
  it('orders titles A to Z', () => {
    expect(['Designer', 'Analyst', 'Manager'].sort(compareTitles)).toEqual([
      'Analyst',
      'Designer',
      'Manager',
    ]);
  });
});
