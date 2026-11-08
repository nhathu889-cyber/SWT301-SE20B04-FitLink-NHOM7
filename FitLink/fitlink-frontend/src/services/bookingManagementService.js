import axios from '@/api/axiosClient'

export const getMyBookings = () => axios.get('/booking/mine')
export const getPTBookings = () => axios.get('/booking/pt/mine')
export const getAllBookings = (params) => axios.get('/booking/admin/all', { params })
export const approveBooking = (id) => axios.post(`/booking/${id}/approve`)
export const rejectBooking = (id) => axios.post(`/booking/${id}/reject`)
export const cancelBooking = (id) => axios.post(`/booking/${id}/cancel`)
