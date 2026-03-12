export const INSURANCE_RATE = 0.08;
export const INSURANCE_MIN_DAILY_AMOUNT = 2;

const toMoneyNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, numericValue);
};

const roundToCents = (value) => Math.round(toMoneyNumber(value) * 100) / 100;

export const computeInsuranceAmount = ({
  rentalAmount = 0,
  rentalDays = 0,
  selected = false,
  explicitAmount = null
} = {}) => {
  if (!selected) return 0;

  const normalizedExplicitAmount = toMoneyNumber(explicitAmount);
  if (normalizedExplicitAmount > 0) {
    return roundToCents(normalizedExplicitAmount);
  }

  const normalizedRentalAmount = toMoneyNumber(rentalAmount);
  const normalizedRentalDays = Math.max(0, Number(rentalDays) || 0);
  const percentageAmount = normalizedRentalAmount * INSURANCE_RATE;
  const minimumAmount = normalizedRentalDays * INSURANCE_MIN_DAILY_AMOUNT;

  return roundToCents(Math.max(percentageAmount, minimumAmount));
};
