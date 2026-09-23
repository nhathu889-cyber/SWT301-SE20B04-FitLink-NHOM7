// s@/services/ptWalletService.js
import axios from "@/api/axiosClient";

export const getMyWallet = async () => {
  const res = await axios.get('/payouts/pt/wallet/my', { skipErrorToast: true })
  
  return res.data
}

export const listMyPayoutRequests = async (params) => {
  const res = await axios.get('/payouts/pt/my-requests', { params, skipErrorToast: true })
  
  return res.data
}

export const createPayoutRequest = async (data) => {
  const res = await axios.post('/payouts/pt/create', data)
  
  return res.data
}

