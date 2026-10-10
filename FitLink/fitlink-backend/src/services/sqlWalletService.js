import PTWallet from '../models/sql/PTWallet.js'
import PTWalletTransaction from '../models/sql/PTWalletTransaction.js'

export const creditPTWalletSQL = async ({ ptId, amount, transactionId, transaction }) => {
  const existed = await PTWalletTransaction.findOne({
    where: { refId: transactionId, refType: 'Transaction' },
    transaction
  })
  if (existed) return { duplicated: true, walletTxn: existed }

  const [wallet] = await PTWallet.findOrCreate({
    where: { ptId },
    defaults: { ptId, available: 0, pending: 0, totalEarned: 0, withdrawn: 0 },
    transaction
  })
  await wallet.increment({ available: amount, totalEarned: amount }, { transaction })
  await wallet.reload({ transaction })
  const balanceAfter = Number(wallet.available) + Number(wallet.pending)
  const walletTxn = await PTWalletTransaction.create({
    ptId,
    type: 'earning',
    direction: 'credit',
    amount,
    refId: transactionId,
    refType: 'Transaction',
    status: 'completed',
    balanceAfter
  }, { transaction })
  return { duplicated: false, walletTxn }
}
