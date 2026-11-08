import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthProvider'
import { logout } from '@/services/authService'

export default function LogoutPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    logout().then(() => {
      setUser(null)
      navigate('/login', { replace: true })
    }).catch(() => setFailed(true))
  }, [setUser, navigate])
  return <p className="p-8">{failed ? 'Không thể đăng xuất. Vui lòng tải lại trang để thử lại.' : 'Đang đăng xuất…'}</p>
}
