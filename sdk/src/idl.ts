export function normalizeIdl<T>(idl: T): T {
  const normalized = normalizeValue(idl) as Record<string, unknown>;

  if (Array.isArray(normalized.accounts) && Array.isArray(normalized.types)) {
    const typeMap = new Map(
      normalized.types
        .filter((entry): entry is { name: string; type: unknown } => {
          return Boolean(
            entry &&
              typeof entry === "object" &&
              "name" in entry &&
              "type" in entry &&
              typeof (entry as { name?: unknown }).name === "string"
          );
        })
        .map((entry) => [entry.name, entry.type])
    );

    normalized.accounts = normalized.accounts.map((account) => {
      if (!account || typeof account !== "object" || "type" in account) {
        return account;
      }

      const name = (account as { name?: unknown }).name;
      if (typeof name !== "string") {
        return account;
      }

      const type = typeMap.get(name);
      return type ? { ...account, type } : account;
    });
  }

  if (Array.isArray(normalized.events) && Array.isArray(normalized.types)) {
    const typeMap = new Map(
      normalized.types
        .filter((entry): entry is { name: string; type: { fields?: unknown } } => {
          return Boolean(
            entry &&
              typeof entry === "object" &&
              "name" in entry &&
              "type" in entry &&
              typeof (entry as { name?: unknown }).name === "string"
          );
        })
        .map((entry) => [entry.name, entry.type])
    );

    normalized.events = normalized.events.map((event) => {
      if (!event || typeof event !== "object" || "fields" in event) {
        return event;
      }

      const name = (event as { name?: unknown }).name;
      if (typeof name !== "string") {
        return event;
      }

      const type = typeMap.get(name);
      if (!type || !Array.isArray(type.fields)) {
        return event;
      }

      return { ...event, fields: type.fields };
    });
  }

  return normalized as T;
}

function normalizeValue(value: unknown): unknown {
  if (value === "pubkey") {
    return "publicKey";
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    if (
      "defined" in value &&
      typeof (value as { defined?: unknown }).defined === "object" &&
      (value as { defined?: { name?: unknown } }).defined?.name &&
      typeof (value as { defined?: { name?: unknown } }).defined?.name === "string"
    ) {
      return {
        ...value,
        defined: (value as { defined: { name: string } }).defined.name,
      };
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, normalizeValue(child)])
    );
  }

  return value;
}
