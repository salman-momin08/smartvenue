import { describe, it, expect } from 'vitest';
import { sanitizeString, validateNumber, validateRole } from '../utils/validation.js';

describe('SmartVenue Security Audit', () => {
  it('should sanitize dangerous HTML characters', () => {
    const dirty = '<script>alert("XSS")</script>';
    const clean = sanitizeString(dirty);
    expect(clean).not.toContain('<');
    expect(clean).toContain('&lt;');
  });

  it('should validate number ranges correctly', () => {
    expect(validateNumber(150, 0, 100)).toBe(100);
    expect(validateNumber(-10, 0, 100)).toBe(0);
    expect(validateNumber(50, 0, 100)).toBe(50);
  });

  it('should normalize user roles', () => {
    expect(validateRole(' OPERATOR ')).toBe('operator');
    expect(validateRole('hacker')).toBe('attendee');
  });
});
