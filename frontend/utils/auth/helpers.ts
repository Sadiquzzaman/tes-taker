/**
 * Masks input values (email or phone) to display only the start and end sections.
 */
export const maskInputValue = (value: string): string => {
  if (value.length <= 6) return value;

  const firstPart = value.slice(0, 3);
  const lastPart = value.slice(-3);
  const middleLength = value.length - 6;

  const maskedSection = "*".repeat(middleLength);

  return firstPart + maskedSection + lastPart;
};

