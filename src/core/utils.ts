export function deepMerge<T>(base: T, override: Partial<T>): T {
  if (!isObject(base) || !isObject(override)) {
    return override === undefined ? base : ({ ...base, ...override } as T);
  }

  const output: Record<string, unknown> = { ...base as Record<string, unknown> };

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }

    const current = output[key];
    if (Array.isArray(current) && Array.isArray(value)) {
      output[key] = value;
      continue;
    }

    if (isObject(current) && isObject(value)) {
      output[key] = deepMerge(
        current as Record<string, unknown>,
        value as Record<string, unknown>
      );
      continue;
    }

    output[key] = value;
  }

  return output as T;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function resolveTemplate(input: unknown, scope: Record<string, unknown>): unknown {
  if (typeof input === "string") {
    return input.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token: string) => {
      const value = token.split(".").reduce<unknown>((current, part) => {
        if (!isObject(current)) {
          return undefined;
        }
        return current[part];
      }, scope);
      return value === undefined ? "" : String(value);
    });
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveTemplate(item, scope));
  }

  if (isObject(input)) {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, resolveTemplate(value, scope)])
    );
  }

  return input;
}
