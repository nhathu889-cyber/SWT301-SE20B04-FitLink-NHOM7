import PTWallet from '~/models/sql/PTWallet.js'

const getMyWallet = async (req, res) => {
  try {
    const wallet = await PTWallet.findOne({ where: { ptId: req.user._id } })
    return res.json({ success: true, data: { available: wallet?.available || 0 } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}


export const ptWalletController = {
    getMyWallet
}