// InputValidator: tiny schema-based validator.
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';
export interface FieldRule { type: FieldType; required?: boolean; min?: number; max?: number; enum?: Array<string | number | boolean>; pattern?: RegExp; }
export type Schema = Record<string, FieldRule>;
export interface ValidationResult { ok: boolean; errors: string[]; value: Record<string, unknown>; }
export class InputValidator {
  validate(schema: Schema, input: unknown): ValidationResult {
    const errors: string[] = []; const value: Record<string, unknown> = {};
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: ['input must be an object'], value: {} };
    const obj = input as Record<string, unknown>;
    for (const [field, rule] of Object.entries(schema)) {
      const raw = obj[field];
      if (raw === undefined || raw === null) { if (rule.required) errors.push(`"${field}" is required`); continue; }
      if (!this.checkType(field, raw, rule.type, errors)) continue;
      if (rule.type === 'string' && typeof raw === 'string') { if (rule.min !== undefined && raw.length < rule.min) errors.push(`"${field}" too short`); if (rule.max !== undefined && raw.length > rule.max) errors.push(`"${field}" too long`); if (rule.pattern && !rule.pattern.test(raw)) errors.push(`"${field}" failed pattern`); }
      if (rule.type === 'number' && typeof raw === 'number') { if (rule.min !== undefined && raw < rule.min) errors.push(`"${field}" below min`); if (rule.max !== undefined && raw > rule.max) errors.push(`"${field}" above max`); }
      if (rule.enum !== undefined && !rule.enum.includes(raw as string | number | boolean)) errors.push(`"${field}" not in allowed set`);
      value[field] = raw;
    }
    return { ok: errors.length === 0, errors, value };
  }
  private checkType(field: string, raw: unknown, type: FieldType, errors: string[]): boolean {
    switch (type) {
      case 'string': if (typeof raw !== 'string') { errors.push(`"${field}" must be a string`); return false; } return true;
      case 'number': if (typeof raw !== 'number' || Number.isNaN(raw)) { errors.push(`"${field}" must be a number`); return false; } return true;
      case 'boolean': if (typeof raw !== 'boolean') { errors.push(`"${field}" must be a boolean`); return false; } return true;
      case 'object': if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) { errors.push(`"${field}" must be an object`); return false; } return true;
      case 'array': if (!Array.isArray(raw)) { errors.push(`"${field}" must be an array`); return false; } return true;
    }
  }
}
