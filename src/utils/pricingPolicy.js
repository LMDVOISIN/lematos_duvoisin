export const PLATFORM_COMMISSION_RATE = 0.12;
export const PAYMENT_FEE_RATE = 0.015;
export const PAYMENT_FEE_FIXED = 0.25;
export const MINIMUM_CHARGE_AMOUNT = 0.51;

export const toMoneyNumber = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

export const roundMoney = (value) => Math.round((Number(value || 0) || 0) * 100) / 100;

export const applyMinimumChargeAmount = (value) => {
  const normalizedValue = roundMoney(Math.max(0, toMoneyNumber(value)));
  if (normalizedValue <= 0) return 0;
  return normalizedValue < MINIMUM_CHARGE_AMOUNT ? MINIMUM_CHARGE_AMOUNT : normalizedValue;
};

export const computeRentalFees = ({ equipmentTotal = 0 } = {}) => {
  const rentalAmount = Math.max(0, toMoneyNumber(equipmentTotal));
  const platformFee = rentalAmount * PLATFORM_COMMISSION_RATE;
  const paymentFee = applyMinimumChargeAmount((rentalAmount * PAYMENT_FEE_RATE) + PAYMENT_FEE_FIXED);
  const totalFees = platformFee + paymentFee;
  const totalToPay = rentalAmount + totalFees;

  return {
    rentalAmount,
    platformFee,
    paymentFee,
    totalFees,
    totalToPay
  };
};

export const computeOwnerNetEstimate = ({
  rentalAmount = 0,
  applyPaymentProcessingFee = true
} = {}) => {
  const normalizedRentalAmount = Math.max(0, toMoneyNumber(rentalAmount));

  const platformCommissionAmount = normalizedRentalAmount * PLATFORM_COMMISSION_RATE;
  const paymentProcessingFeeAmount = applyPaymentProcessingFee
    ? applyMinimumChargeAmount((normalizedRentalAmount * PAYMENT_FEE_RATE) + PAYMENT_FEE_FIXED)
    : 0;

  const ownerNetEstimate = Math.max(
    0,
    normalizedRentalAmount - platformCommissionAmount - paymentProcessingFeeAmount
  );

  return {
    ownerNetEstimate,
    platformCommissionAmount,
    paymentProcessingFeeAmount
  };
};

export const computeChargedAmount = ({ equipmentTotal = 0, cautionAmount = 0 } = {}) => {
  const checkout = computeRentalFees({ equipmentTotal });
  const normalizedCautionAmount = Math.max(0, toMoneyNumber(cautionAmount));

  return {
    ...checkout,
    cautionAmount: normalizedCautionAmount,
    // Empreinte CB: autorisation bancaire non débitée au checkout.
    chargedAmount: checkout.totalToPay,
    authorizedAmount: normalizedCautionAmount
  };
};
