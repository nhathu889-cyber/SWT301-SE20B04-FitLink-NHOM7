import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  const destination = !user ? '/login' : user.role === 'admin' ? '/admin' : user.role === 'pt' ? '/pt' : '/home';
  return <Navigate to={destination} replace />;
}
