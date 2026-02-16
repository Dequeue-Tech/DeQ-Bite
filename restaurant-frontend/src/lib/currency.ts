export const formatInr = (paise: number): string => {
  const amount = Number.isFinite(paise) ? paise / 100 : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    currencyDisplay: 'code',
    maximumFractionDigits: 2,
  }).format(amount);
};

export const toPaise = (amount: number): number => Math.round(amount * 100);
