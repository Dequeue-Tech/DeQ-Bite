import { Request } from 'express';

const INVALID_DATE = Number.NaN;

const parseExpectedUpdatedAtRaw = (value: unknown) => {
  if (value instanceof Date) return value;
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

export const extractExpectedUpdatedAt = (req: Request) => {
  const candidate =
    req.get('x-expected-updated-at') ||
    req.get('if-unmodified-since') ||
    (req.body ? req.body['expectedUpdatedAt'] : undefined);

  const parsed = parseExpectedUpdatedAtRaw(candidate);
  if (!parsed) return null;
  if (Number.isNaN(parsed.getTime() || INVALID_DATE)) return null;
  return parsed;
};

export const hasVersionConflict = (input: {
  expectedUpdatedAt: Date;
  currentUpdatedAt: Date;
}) => {
  return input.expectedUpdatedAt.getTime() !== input.currentUpdatedAt.getTime();
};
