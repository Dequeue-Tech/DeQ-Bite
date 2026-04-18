"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasVersionConflict = exports.extractExpectedUpdatedAt = void 0;
const INVALID_DATE = Number.NaN;
const parseExpectedUpdatedAtRaw = (value) => {
    if (value instanceof Date)
        return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value);
    }
    if (typeof value === 'string' && value.trim()) {
        const raw = value.trim();
        const asNumber = Number(raw);
        if (Number.isFinite(asNumber)) {
            return new Date(asNumber);
        }
        return new Date(raw);
    }
    return null;
};
const extractExpectedUpdatedAt = (req) => {
    const candidate = req.get('x-expected-updated-at') ||
        req.get('if-unmodified-since') ||
        (req.body ? req.body['expectedUpdatedAt'] : undefined);
    const parsed = parseExpectedUpdatedAtRaw(candidate);
    if (!parsed)
        return null;
    if (Number.isNaN(parsed.getTime() || INVALID_DATE))
        return null;
    return parsed;
};
exports.extractExpectedUpdatedAt = extractExpectedUpdatedAt;
const hasVersionConflict = (input) => {
    return input.expectedUpdatedAt.getTime() !== input.currentUpdatedAt.getTime();
};
exports.hasVersionConflict = hasVersionConflict;
//# sourceMappingURL=order-lock.js.map