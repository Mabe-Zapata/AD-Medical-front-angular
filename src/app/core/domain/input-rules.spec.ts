import { isValidThreshold, parseThreshold, sanitizeThreshold, sanitizeUnit } from './text';

describe('knowledge input rules', () => {
  it('keeps only letters and "/" in units', () => {
    expect(sanitizeUnit('mg/dL 10^9')).toBe('mg/dL');
    expect(sanitizeUnit('😀g/dL')).toBe('g/dL');
  });

  it('keeps only digits, "." and "," in thresholds', () => {
    expect(sanitizeThreshold('12a.5,😀')).toBe('12.5,');
  });

  it('accepts up to 12 integer digits and 6 decimals, rejects the rest', () => {
    expect(isValidThreshold('12,5')).toBe(true);
    expect(isValidThreshold('123456789012.123456')).toBe(true);
    expect(isValidThreshold('9999999999999999')).toBe(false);
    expect(isValidThreshold('1.2.3')).toBe(false);
    expect(parseThreshold('12,5')).toBe(12.5);
  });
});
