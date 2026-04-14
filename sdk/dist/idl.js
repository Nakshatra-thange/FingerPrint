"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIdl = normalizeIdl;
function normalizeIdl(idl) {
    const normalized = normalizeValue(idl);
    if (Array.isArray(normalized.accounts) && Array.isArray(normalized.types)) {
        const typeMap = new Map(normalized.types
            .filter((entry) => {
            return Boolean(entry &&
                typeof entry === "object" &&
                "name" in entry &&
                "type" in entry &&
                typeof entry.name === "string");
        })
            .map((entry) => [entry.name, entry.type]));
        normalized.accounts = normalized.accounts.map((account) => {
            if (!account || typeof account !== "object" || "type" in account) {
                return account;
            }
            const name = account.name;
            if (typeof name !== "string") {
                return account;
            }
            const type = typeMap.get(name);
            return type ? { ...account, type } : account;
        });
    }
    if (Array.isArray(normalized.events) && Array.isArray(normalized.types)) {
        const typeMap = new Map(normalized.types
            .filter((entry) => {
            return Boolean(entry &&
                typeof entry === "object" &&
                "name" in entry &&
                "type" in entry &&
                typeof entry.name === "string");
        })
            .map((entry) => [entry.name, entry.type]));
        normalized.events = normalized.events.map((event) => {
            if (!event || typeof event !== "object" || "fields" in event) {
                return event;
            }
            const name = event.name;
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
    return normalized;
}
function normalizeValue(value) {
    if (value === "pubkey") {
        return "publicKey";
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item));
    }
    if (value && typeof value === "object") {
        if ("defined" in value &&
            typeof value.defined === "object" &&
            value.defined?.name &&
            typeof value.defined?.name === "string") {
            return {
                ...value,
                defined: value.defined.name,
            };
        }
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeValue(child)]));
    }
    return value;
}
