// ============================================
// SELECT FIELD UTILITIES
// ============================================
// Helpers for optimizing field selection and avoiding over-fetching

// ─────────────────────────────────────────
// COMMON FIELD SETS
// ─────────────────────────────────────────

/**
 * Public user fields (safe to expose in API responses)
 */
export const publicUserFields = {
  id: true,
  email: true,
  name: true,
  role: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Sensitive fields that should never be selected by default
 */
export const sensitiveFields = [
  'passwordHash',
  'pinHash',
  'mfaSecret',
  'mfaBackupCodes',
  'refreshToken',
  'resetToken',
  'verificationToken',
] as const;

// ─────────────────────────────────────────
// SELECT BUILDERS
// ─────────────────────────────────────────

/**
 * Create a Prisma select object from an array of field names
 *
 * @example
 * ```typescript
 * const select = selectFields(['id', 'name', 'email']);
 * // { id: true, name: true, email: true }
 * ```
 */
export function selectFields<T extends string>(
  fields: readonly T[]
): Record<T, true> {
  return fields.reduce(
    (acc, field) => {
      acc[field] = true;
      return acc;
    },
    {} as Record<T, true>
  );
}

/**
 * Create a Prisma select object that excludes specific fields
 *
 * @example
 * ```typescript
 * const select = excludeFields(allUserFields, ['passwordHash', 'mfaSecret']);
 * ```
 */
export function excludeFields<T extends string>(
  allFields: readonly T[],
  exclude: readonly string[]
): Record<string, true> {
  return allFields
    .filter((field) => !exclude.includes(field))
    .reduce(
      (acc, field) => {
        acc[field] = true;
        return acc;
      },
      {} as Record<string, true>
    );
}

/**
 * Build a select object from include/exclude options
 *
 * @example
 * ```typescript
 * const select = buildSelect({
 *   base: publicUserFields,
 *   include: ['phoneNumber'],
 *   exclude: ['email'],
 * });
 * ```
 */
export function buildSelect<T extends Record<string, boolean>>(options: {
  base?: T;
  include?: string[];
  exclude?: string[];
}): Record<string, true> {
  const result: Record<string, true> = {};

  // Add base fields
  if (options.base) {
    for (const [key, value] of Object.entries(options.base)) {
      if (value === true) {
        result[key] = true;
      }
    }
  }

  // Add included fields
  if (options.include) {
    for (const field of options.include) {
      result[field] = true;
    }
  }

  // Remove excluded fields
  if (options.exclude) {
    for (const field of options.exclude) {
      delete result[field];
    }
  }

  return result;
}

// ─────────────────────────────────────────
// FIELD VALIDATION
// ─────────────────────────────────────────

/**
 * Validate that requested fields are allowed
 */
export function validateSelectFields(
  requested: string[],
  allowed: readonly string[]
): { valid: string[]; invalid: string[] } {
  const allowedSet = new Set(allowed);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const field of requested) {
    if (allowedSet.has(field)) {
      valid.push(field);
    } else {
      invalid.push(field);
    }
  }

  return { valid, invalid };
}

/**
 * Remove sensitive fields from any object
 */
export function removeSensitiveFields<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: readonly string[] = sensitiveFields
): Partial<T> {
  const result = { ...obj };

  for (const key of sensitiveKeys) {
    delete result[key as keyof T];
  }

  return result;
}

// ─────────────────────────────────────────
// RESPONSE TRANSFORMERS
// ─────────────────────────────────────────

/**
 * Transform database result to API response (removes sensitive fields)
 */
export function toPublicUser<T extends Record<string, unknown>>(user: T): Partial<T> {
  return removeSensitiveFields(user);
}

/**
 * Transform array of results
 */
export function toPublicUsers<T extends Record<string, unknown>>(
  users: T[]
): Partial<T>[] {
  return users.map(toPublicUser);
}
