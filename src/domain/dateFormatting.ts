type FirestoreTimestampLike = {
  seconds?: unknown;
  toDate?: unknown;
};

export const parseValidDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    if (!normalizedValue || normalizedValue.toLowerCase() === 'invalid date') return null;

    const parsedDate = new Date(normalizedValue);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (value && typeof value === 'object') {
    const timestamp = value as FirestoreTimestampLike;
    if (typeof timestamp.toDate === 'function') {
      const parsedDate = timestamp.toDate();
      return parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    }

    if (typeof timestamp.seconds === 'number') {
      const parsedDate = new Date(timestamp.seconds * 1000);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
  }

  return null;
};

export const formatDate = (
  value: unknown,
  locale = 'vi-VN',
  fallback = '—'
): string => parseValidDate(value)?.toLocaleDateString(locale) || fallback;

export const formatDateTime = (
  value: unknown,
  locale = 'vi-VN',
  fallback = '—'
): string => parseValidDate(value)?.toLocaleString(locale) || fallback;

export const formatTime = (
  value: unknown,
  locale = 'vi-VN',
  fallback = '—'
): string => parseValidDate(value)?.toLocaleTimeString(locale, {
  hour: '2-digit',
  minute: '2-digit'
}) || fallback;

export const toDateInputValue = (value: unknown): string => {
  if (typeof value === 'string') {
    const isoDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (isoDate && parseValidDate(isoDate)) return isoDate;
  }

  const parsedDate = parseValidDate(value);
  if (!parsedDate) return '';

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
