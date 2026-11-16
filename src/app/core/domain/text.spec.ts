import { describe, expect, it } from 'vitest';
import {
  hasEmoji,
  isValidEmail,
  isValidName,
  normalizeSearch,
  sanitizeEmail,
  sanitizeFreeText,
  sanitizeIdentifier,
  sanitizeName,
  sanitizePassword,
  sanitizeSearch,
  stripEmoji,
  isValidPersonName,
  sanitizePersonName,
  sanitizeClinicalText,
  sanitizeLabel,
  isValidClinicalText,
} from './text';

describe('text sanitization and validation', () => {
  it('detects and strips emojis properly', () => {
    expect(hasEmoji('Hola 👨‍⚕️')).toBe(true);
    expect(hasEmoji('Hola')).toBe(false);
    expect(stripEmoji('Juan 😀 Pérez')).toBe('Juan  Pérez');
  });

  it('normalizes search terms', () => {
    expect(normalizeSearch('  Ángel MENDOZA  ')).toBe('angel mendoza');
  });

  it('sanitizes names by removing emojis, numbers, and special symbols while keeping Spanish diacritics', () => {
    expect(sanitizeName('María-José 123 🩺 <script> O\'Connor')).toBe("María-José   script O'Connor");
    expect(sanitizeName('Ángel Nuñez')).toBe('Ángel Nuñez');
    expect(isValidName('María José')).toBe(true);
    expect(isValidName('José-Luis O\'Connor')).toBe(true);
    expect(isValidName('Juan 123')).toBe(false);
    expect(isValidName('Juan 😃')).toBe(false);
    expect(isValidName('')).toBe(false);
  });

  it('sanitizes and validates emails', () => {
    expect(sanitizeEmail('  juan.perez@lab.com  ')).toBe('juan.perez@lab.com');
    expect(sanitizeEmail('juan😀@lab.com')).toBe('juan@lab.com');
    expect(sanitizeEmail('juan<script>@lab.com')).toBe('juanscript@lab.com');
    expect(isValidEmail('usuario@dominio.com')).toBe(true);
    expect(isValidEmail('usuario.nombre+test@sub.dominio.org')).toBe(true);
    expect(isValidEmail('sin-arroba')).toBe(false);
    expect(isValidEmail('usuario😃@dominio.com')).toBe(false);
  });

  it('sanitizes password by stripping emojis', () => {
    expect(sanitizePassword('Super$ecret123!🔒')).toBe('Super$ecret123!');
  });

  it('sanitizes search terms and identifiers', () => {
    expect(sanitizeSearch('Juan <perez> & $foo')).toBe('Juan perez & foo');
    expect(sanitizeIdentifier('550e8400-e29b-41d4-a716-446655440000 😃')).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(sanitizeIdentifier('TEST-MED-0001!#')).toBe('TEST-MED-0001');
    expect(sanitizeSearch('Ana© 💊 ok')).toBe('Ana  ok');
    expect(sanitizeSearch('TEST-MED-0001 ✅')).toBe('TEST-MED-0001 ');
  });

  it('keeps account names to letters with single spaces', () => {
    expect(sanitizePersonName('  María   José 2 ©')).toBe('María José ');
    expect(sanitizePersonName("O'Connor-🙂")).toBe('OConnor');
    expect(isValidPersonName('María José')).toBe(true);
    expect(isValidPersonName('María  José')).toBe(false);
    expect(isValidPersonName("José-Luis")).toBe(false);
    expect(isValidPersonName('   ')).toBe(false);
  });

  it('keeps catalog labels free of leading and repeated spaces', () => {
    expect(sanitizeLabel('😀 😀 😀')).toBe('');
    expect(sanitizeLabel('  Glucosa   en ayunas')).toBe('Glucosa en ayunas');
    expect(sanitizeLabel('Hemoglobina 💊 glicosilada')).toBe('Hemoglobina glicosilada');
  });

  it('validates the email format and rejects inner spaces', () => {
    expect(isValidEmail('ana.perez@lab.com.ec')).toBe(true);
    expect(isValidEmail('ana perez@lab.com')).toBe(false);
    expect(isValidEmail('ana@lab')).toBe(false);
    expect(sanitizeEmail('ana 😀 @lab.com')).toBe('ana@lab.com');
    expect(sanitizeEmail('ana👨🏽‍⚕️​⁠🇪🇨 @lab.com')).toBe('ana@lab.com');
  });

  it('sanitizes free text', () => {
    expect(sanitizeFreeText('Motivo válido: paciente solicita alta médica. <script>')).toBe(
      'Motivo válido: paciente solicita alta médica. script',
    );
    expect(sanitizeFreeText('a © b')).toBe('a  b');
    expect(sanitizeFreeText('Ok ¿sí? ¡bien! 50% ✓')).toBe('Ok ¿sí? ¡bien! 50% ');
  });

  it('sanitizes and validates clinical text (diagnoses, treatments)', () => {
    expect(sanitizeClinicalText('Faringitis aguda 💊: reposo por 3 días <script>')).toBe(
      'Faringitis aguda : reposo por 3 días script',
    );
    expect(isValidClinicalText('Hipertensión arterial grado 1 (140/90 mmHg).')).toBe(true);
    expect(isValidClinicalText('Amoxicilina 500mg c/8h - 7 días (50% dosis).')).toBe(true);
    expect(isValidClinicalText('Gripe común 🤒')).toBe(false);
    expect(isValidClinicalText('Diagnóstico <script>alert(1)</script>')).toBe(false);
    expect(isValidClinicalText('a'.repeat(1001), 1000)).toBe(false);
  });
});
