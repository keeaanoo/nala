export type StandardRoleName =
  | 'Supervisor'
  | 'Evaluator'
  | 'Staff Shift Group A'
  | 'Staff Shift Group B'
  | 'Staff Shift Group C'
  | 'Staff Shift Group D';

/**
 * Standardize any user name, role, username, or historical record to strictly one of the 6 roles:
 * - Supervisor
 * - Evaluator
 * - Staff Shift Group A
 * - Staff Shift Group B
 * - Staff Shift Group C
 * - Staff Shift Group D
 */
export function formatStandardRoleName(rawNameOrRole?: string | null): StandardRoleName {
  if (!rawNameOrRole) return 'Supervisor';
  const str = rawNameOrRole.trim();
  const lower = str.toLowerCase();

  // Evaluator
  if (lower.includes('evaluator') || lower.includes('dewi') || lower.includes('eval')) {
    return 'Evaluator';
  }

  // Staff Groups
  if (lower.includes('group d') || lower.includes('staff_d') || lower.includes('eko')) {
    return 'Staff Shift Group D';
  }
  if (lower.includes('group c') || lower.includes('staff_c') || lower.includes('bambang')) {
    return 'Staff Shift Group C';
  }
  if (lower.includes('group b') || lower.includes('staff_b') || lower.includes('dimas')) {
    return 'Staff Shift Group B';
  }
  if (
    lower.includes('group a') || 
    lower.includes('staff_a') || 
    lower.includes('rian') || 
    lower.includes('agus') || 
    lower.includes('petugas')
  ) {
    return 'Staff Shift Group A';
  }

  if (lower.includes('staff')) {
    return 'Staff Shift Group A';
  }

  // Supervisor / Admin / Hendrawan / Budi / System
  return 'Supervisor';
}
