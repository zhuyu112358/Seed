import { Ajv, type ErrorObject } from 'ajv';
import type { ILogger, ValidationResult, ValidationSchema } from '../types/index.js';
import { looksInjective, sanitizeString } from './sanitize.js';

class NullLogger implements ILogger {
  debug(): void {} info(): void {} warn(): void {} error(): void {} fatal(): void {}
  child(): ILogger { return this; }
}

interface JsonSchema {
  type?: string; required?: string[]; properties?: Record<string, JsonSchema>;
  minimum?: number; maximum?: number; pattern?: string; enum?: unknown[]; items?: JsonSchema;
}

export class InputValidator {
  private readonly ajv: Ajv;
  private readonly compiled = new Map<string, (data: unknown) => boolean>();
  private readonly logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger ?? new NullLogger();
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.registerBuiltIns();
  }

  private convert(schema: ValidationSchema): JsonSchema {
    const out: JsonSchema = { type: schema.type };
    if (schema.required) out.required = schema.required;
    if (schema.properties) { out.properties = {}; for (const [k, v] of Object.entries(schema.properties)) out.properties[k] = this.convert(v); }
    if (schema.min !== undefined) out.minimum = schema.min;
    if (schema.max !== undefined) out.maximum = schema.max;
    if (schema.pattern) out.pattern = schema.pattern;
    if (schema.enum) out.enum = schema.enum;
    if (schema.items) out.items = this.convert(schema.items);
    return out;
  }

  registerSchema(name: string, schema: ValidationSchema): void {
    const compiled = this.ajv.compile(this.convert(schema));
    this.compiled.set(name, (data: unknown) => compiled(data));
  }

  validate(name: string, data: unknown): ValidationResult {
    const check = this.compiled.get(name);
    if (!check) return { valid: false, errors: [{ field: name, message: `Unknown schema "${name}"` }] };
    return this.run(check, data);
  }

  validateInline(schema: ValidationSchema, data: unknown): ValidationResult {
    const check = this.ajv.compile(this.convert(schema));
    return this.run(check, data);
  }

  private run(check: (data: unknown) => boolean, data: unknown): ValidationResult {
    const ok = check(data);
    if (ok) return { valid: true, errors: [] };
    const errors = ((this.ajv.errors ?? []) as ErrorObject[]).map((e) => ({
      field: e.instancePath || (e.params.missingProperty as string) || '(root)',
      message: e.message ?? 'invalid',
    }));
    return { valid: false, errors: errors.length ? errors : [{ field: '(root)', message: 'invalid data' }] };
  }

  sanitize(input: unknown, maxLen = 500): { clean: unknown; injected: boolean } {
    if (typeof input !== 'string') return { clean: input, injected: false };
    const injected = looksInjective(input);
    return { clean: sanitizeString(input, maxLen), injected };
  }

  getRegisteredSchemas(): string[] { return Array.from(this.compiled.keys()); }

  private registerBuiltIns(): void {
    this.registerSchema('ActionRequest', {
      type: 'object', required: ['action', 'soulId'],
      properties: {
        action: { type: 'string', enum: ['move', 'interact', 'communicate', 'observe'] },
        soulId: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
        targetId: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
        payload: { type: 'object' },
      },
    });
    this.registerSchema('PerceptionFrameConfig', {
      type: 'object', required: ['distance'],
      properties: { distance: { type: 'number', min: 0, max: 5000 }, fov: { type: 'number', min: 0, max: 360 }, includeSounds: { type: 'boolean' }, includeVisuals: { type: 'boolean' } },
    });
    this.registerSchema('EntityConfig', {
      type: 'object', required: ['type'],
      properties: { type: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,32}$' }, position: { type: 'object' }, name: { type: 'string', max: 64 }, properties: { type: 'object' } },
    });
    this.registerSchema('CommunicationMessage', {
      type: 'object', required: ['from', 'body'],
      properties: { from: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' }, to: { type: 'string' }, body: { type: 'string', max: 1000 }, channel: { type: 'string', max: 64 } },
    });
    this.registerSchema('WorldEventTrigger', {
      type: 'object', required: ['eventType'],
      properties: { eventType: { type: 'string', pattern: '^[a-z_]{2,32}$' }, source: { type: 'string' }, data: { type: 'object' } },
    });
    this.logger.debug('Built-in schemas registered', { count: this.compiled.size });
  }
}
