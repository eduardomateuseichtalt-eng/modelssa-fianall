const STARTING_FROM_PREFIX = /^\s*a\s+partir\s+de\s*:?\s*/i;

export const normalizeMotelPrice = (value) =>
  String(value || "").replace(STARTING_FROM_PREFIX, "").trim();

export const formatMotelPrice = (value) => {
  const price = normalizeMotelPrice(value);
  return price ? `A partir de: ${price}` : "";
};
