export function netPartnerEarnings(grossEarnings: number, commissionPercent: number) {
  const commissionAmount = (grossEarnings * commissionPercent) / 100;
  return Math.round((grossEarnings - commissionAmount) * 100) / 100;
}
