export const manualPayment = {
  enabled: true,
  amount: 5000,
  bank: 'MB',
  accountNumber: '01014941105',
  accountName: 'NGUYEN MINH NHAT'
}
export const transferDetails = transaction => {
  const reference = `FL${transaction.id.replace(/-/g, '').toUpperCase()}`
  const params = new URLSearchParams({ amount: String(transaction.amount), addInfo: reference, accountName: manualPayment.accountName })
  return { ...manualPayment, amount: Number(transaction.amount), reference, qrUrl: `https://img.vietqr.io/image/MB-${manualPayment.accountNumber}-compact2.png?${params}` }
}
