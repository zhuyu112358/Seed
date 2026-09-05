/**
 * Seed Engine - InputValidator
 *
 * Schema-based input validation built on AJV. It:
 *  - Registers named schemas and validates arbitrary payloads against them
 *  - Collects ALL validation errors (never fails fast) for comprehensive feedback
 *  - Sanitizes free-form strings (strips control characters, caps length, and
 *    flags SQL / JS / shell injection patterns) as a second defence line
 *  - Ships built-in schemas for the core engine messages (ActionRequest,
 *    PerceptionFrame config, EntityConfig, CommunicationMessage, WorldEvent
 *    trigger)
 *
 * The ValidationSchema type from src/types is a small JSON-Schema subset; it is
 * converted to a real JSON Schema before being handed to AJV.
 */

import {
  Ajv,
  type ErrorObject,
  type JSONSchemaType,
  type ValidateFunction,
} from 'ajv';
import type {
  ILogger,
  ValidationResult,
  ValidationSchema,
} from '../types/index.js';

/**
 * Strip C0/C1 control characters out of a free-form string. Built with an
 * escaped RegExp so the source stays free of literal control bytes.
 */
const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/** Patterns that indicate SQL / JS / shell injection attempts. */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /<\s*script/i, label: 'script-injection' },
  { pattern: /\b(DROP|DELETE|TRUNCATE|ALTER)\s+TABLE/i, label: 'sql-injection' },
  { pattern: /(\$|%7B)\s*\{.*\}/i, label: 'template-injection' },
  { pattern: /;\s*rm\s+-rf/i, label: 'shell-injection' },
  { pattern: /\b(UNION\s+SELECT|INSERT\s+INTO|EXEC\s*\()/i, label: 'sql-injection' },
  { pattern: /javascript\s*:/i, label: 'javascript-uri' },
];

class NullLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  fatal(): void {}
  child(): ILogger {
    return this;
  }
}

export class InputValidator {
  private readonly ajv: Ajv;
  private readonly logger: ILogger;
  private readonly compiled = new Map<string, ValidateFunction>();

  constructor(logger?: ILogger) {
    this.logger = logger ?? new NullLogger();
    this.ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
    this.registerBuiltinSchemas();
  }

  /**
   * Convert the project's minimal ValidationSchema into a JSON Schema document
   * understood by AJV.
   */
  private toJsonSchema(schema: ValidationSchema): JSONSchemaType<unknown> {
    const json: Record<string, unknown> = { type: schema.type };

    if (schema.type === 'object') {
      if (schema.properties) {
        const converted: Record<string, JSONSchemaType<unknown>> = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          converted[key] = this.toJsonSchema(value);
        }
        json.properties = converted;
      }
      if (schema.required && schema.required.length > 0) {
        json.required = schema.required;
      }
      json.additionalProperties = true;
    } else if (schema.type === 'array') {
      if (schema.items) {
        json.items = this.toJsonSchema(schema.items);
      }
      if (schema.min !== undefined) json.minItems = schema.min;
      if (schema.max !== undefined) json.maxItems = schema.max;
    } else if (schema.type === 'string') {
      if (schema.min !== undefined) json.minLength = schema.min;
      if (schema.max !== undefined) json.maxLength = schema.max;
      if (schema.pattern !== undefined) json.pattern = schema.pattern;
      if (schema.enum !== undefined) json.enum = schema.enum;
    } else if (schema.type === 'number') {
      if (schema.min !== undefined) json.minimum = schema.min;
      if (schema.max !== undefined) json.maximum = schema.max;
      if (schema.enum !== undefined) json.enum = schema.enum;
    } else if (schema.type === 'boolean') {
      if (schema.enum !== undefined) json.enum = schema.enum;
    }

    return json as JSONSchemaType<unknown>;
  }

  /** Register a named schema for later reuse via validate(). */
  registerSchema(name: string, schema: ValidationSchema): void {
    const jsonSchema = this.toJsonSchema(schema);
    const validate = this.ajv.compile(jsonSchema);
    this.compiled.set(name, validate);
    this.logger.debug('Validation schema registered', { name });
  }

  /** Validate data against a previously registered named schema. */
  validate(name: string, data: unknown): ValidationResult {
    const validate = this.compiled.get(name);
    if (!validate) {
      return {
        valid: false,
        errors: [{ field: name, message: `Unknown schema "${name}"` }],
      };
    }

    // Sanitize string fields defensively before structural validation.
    const cleaned = this.sanitizeUnknown(data);
    const valid = validate(cleaned);
    const errors = this.collectErrors(validate.errors);

    if (!valid) {
      this.logger.debug('Validation failed', { name, errorCount: errors.length });
    }
    return { valid, errors };
  }

  /** Validate data against an inline (unregistered) schema. */
  validateInline(schema: ValidationSchema, data: unknown): ValidationResult {
    const jsonSchema = this.toJsonSchema(schema);
    const validate = this.ajv.compile(jsonSchema);
    const cleaned = this.sanitizeUnknown(data);
    const valid = validate(cleaned);
    return { valid, errors: this.collectErrors(validate.errors) };
  }

  /** All registered schema names. */
  getRegisteredSchemas(): string[] {
    return Array.from(this.compiled.keys());
  }

  /**
   * Sanitize a single string: strip control characters and cap length. Exported
   * so callers can sanitize free-form text (names, chat) directly.
   */
  sanitizeString(input: string, maxLen = 1000): string {
    let out = input.replace(CONTROL_CHARACTERS, '');
    if (out.length > maxLen) out = out.slice(0, maxLen);
    return out;
  }

  /** Heuristic check for injection-looking strings. */
  isInjective(input: string): boolean {
    return INJECTION_PATTERNS.some((entry) => entry.pattern.test(input));
  }

  /** Recursively sanitize string leaves of an arbitrary value. */
  private sanitizeUnknown(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeUnknown(item));
    }
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        out[key] = this.sanitizeUnknown(item);
      }
      return out;
    }
    return value;
  }

  /** Normalize AJV error objects into the engine's ValidationResult shape. */
  private collectErrors(errors: ErrorObject[] | null): Array<{ field: string; message: string }> {
    if (!errors) return [];
    return errors.map((err) => {
      const field = err.instancePath === '' ? '/' : err.instancePath;
      let message = err.message ?? 'invalid';
      const allowed = (err as ErrorObject & { allowedValues?: unknown[] }).allowedValues;
      if (err.keyword === 'enum' && Array.isArray(allowed)) {
        message = `must be one of: ${allowed.join(', ')}`;
      }
      return { field, message };
    });
  }

  /** Register the built-in engine schemas. */
  private registerBuiltinSchemas(): void {
    // ActionRequest: what a soul wants to do.
    this.registerSchema('ActionRequest', {
      type: 'object',
      required: ['soulId', 'action', 'parameters', 'timestamp'],
      properties: {
        soulId: { type: 'string', min: 1, max: 128 },
        action: {
          type: 'string',
          enum: ['move', 'interact', 'communicate', 'use', 'attack', 'wait', 'custom'],
        },
        targetId: { type: 'string', max: 128 },
        parameters: { type: 'object' },
        timestamp: { type: 'number', min: 0 },
      },
    });

    // PerceptionFrame configuration (how a frame is generated).
    this.registerSchema('PerceptionFrameConfig', {
      type: 'object',
      required: ['soulId', 'maxDistance'],
      properties: {
        soulId: { type: 'string', min: 1, max: 128 },
        maxDistance: { type: 'number', min: 0, max: 100000 },
        includeEvents: { type: 'boolean' },
        includeCommunications: { type: 'boolean' },
        nearSoulsLimit: { type: 'number', min: 0, max: 1000 },
      },
    });

    // EntityConfig: creation/update payload for an entity.
    this.registerSchema('EntityConfig', {
      type: 'object',
      required: ['type', 'name'],
      properties: {
        id: { type: 'string', max: 128 },
        type: {
          type: 'string',
          enum: ['static', 'dynamic', 'interactive', 'soul', 'npc', 'trigger', 'effect'],
        },
        name: { type: 'string', min: 1, max: 200 },
        mass: { type: 'number', min: 0, max: 1000000 },
        material: {
          type: 'string',
          enum: ['wood', 'stone', 'metal', 'glass', 'water', 'fire', 'earth', 'air', 'organic', 'energy', 'custom'],
        },
        isStatic: { type: 'boolean' },
        isTrigger: { type: 'boolean' },
      },
    });

    // CommunicationMessage: a message routed through the world.
    this.registerSchema('CommunicationMessage', {
      type: 'object',
      required: ['id', 'senderId', 'senderType', 'medium', 'content', 'timestamp', 'priority', 'ttl'],
      properties: {
        id: { type: 'string', min: 1, max: 128 },
        senderId: { type: 'string', min: 1, max: 128 },
        senderType: { type: 'string', enum: ['soul', 'entity', 'system'] },
        medium: { type: 'string', enum: ['acoustic', 'network', 'resonance', 'telepathic', 'custom'] },
        content: { type: 'string', min: 0, max: 4096 },
        timestamp: { type: 'number', min: 0 },
        priority: { type: 'number', min: 0, max: 10 },
        ttl: { type: 'number', min: 0, max: 86_400_000 },
      },
    });

    // WorldEvent trigger: request to fire a world event.
    this.registerSchema('WorldEventTrigger', {
      type: 'object',
      required: ['type', 'name', 'severity', 'position', 'radius'],
      properties: {
        type: { type: 'string', min: 1, max: 128 },
        name: { type: 'string', min: 1, max: 200 },
        severity: { type: 'string', enum: ['info', 'minor', 'moderate', 'major', 'catastrophic'] },
        radius: { type: 'number', min: 0, max: 100000 },
        duration: { type: 'number', min: 0, max: 86_400_000 },
        position: {
          type: 'object',
          required: ['x', 'y', 'z'],
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
          },
        },
      },
    });
  }
}
