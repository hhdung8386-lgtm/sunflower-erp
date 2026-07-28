type FirestoreTimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
};

const toTimestamp = (value: unknown): number | null => {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (!value || typeof value !== 'object') return null;

  const timestampValue = value as FirestoreTimestampLike;
  if (typeof timestampValue.toDate === 'function') {
    try {
      const timestamp = timestampValue.toDate().getTime();
      if (Number.isFinite(timestamp)) return timestamp;
    } catch {
      // Fall through to the serialized Firestore timestamp fields below.
    }
  }

  const seconds = timestampValue.seconds ?? timestampValue._seconds;
  if (!Number.isFinite(seconds)) return null;

  const nanoseconds = timestampValue.nanoseconds ?? timestampValue._nanoseconds ?? 0;
  return Number(seconds) * 1000 + Number(nanoseconds) / 1_000_000;
};

const getFirstValidTimestamp = (values: readonly unknown[]): number | null => {
  for (const value of values) {
    const timestamp = toTimestamp(value);
    if (timestamp !== null) return timestamp;
  }
  return null;
};

/**
 * Returns a stable copy ordered from newest to oldest without mutating the
 * collection supplied by Firebase or by a parent component.
 */
export const sortNewestFirst = <T>(
  records: readonly T[],
  getDateCandidates: (record: T) => readonly unknown[]
): T[] => records
  .map((record, originalIndex) => ({
    record,
    originalIndex,
    timestamp: getFirstValidTimestamp(getDateCandidates(record))
  }))
  .sort((recordA, recordB) => {
    if (recordA.timestamp === null && recordB.timestamp === null) {
      return recordA.originalIndex - recordB.originalIndex;
    }
    if (recordA.timestamp === null) return 1;
    if (recordB.timestamp === null) return -1;

    const timestampDifference = recordB.timestamp - recordA.timestamp;
    return timestampDifference !== 0
      ? timestampDifference
      : recordA.originalIndex - recordB.originalIndex;
  })
  .map(({ record }) => record);
