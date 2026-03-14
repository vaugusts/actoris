export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge<T>(base: T, override: Partial<T>): T {
  if (!isObject(base) || !isObject(override)) {
    if (override === undefined) {
      return base;
    }

    return { ...(base as Record<string, unknown>), ...(override as Record<string, unknown>) } as T;
  }

  const output: Record<string, unknown> = { ...base };

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
      output[key] = deepMerge(current, value);
      continue;
    }

    output[key] = value;
  }

  return output as T;
}

export function resolveTemplate(input: unknown, scope: Record<string, unknown>): unknown {
  if (typeof input === "string") {
    return input.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, token) => {
      const value = String(token)
        .split(".")
        .reduce<unknown>((current, part) => (isObject(current) ? current[part] : undefined), scope);

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

export function resolveEnvPlaceholders<T>(input: T): T {
  return resolveNode(input) as T;
}

function resolveNode(input: unknown): unknown {
  if (typeof input === "string") {
    return input.replace(/\$\{([^}]+)\}/g, (_match, name) => process.env[String(name)] ?? "");
  }

  if (Array.isArray(input)) {
    return input.map(resolveNode);
  }

  if (isObject(input)) {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, resolveNode(value)]));
  }

  return input;
}

export function isEnabled(value: unknown, fallback = true): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() !== "false";
}
