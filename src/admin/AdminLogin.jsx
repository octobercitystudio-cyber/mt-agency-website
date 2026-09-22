import { Navigate } from 'react-router-dom';

// Keep the legacy entry on the same phone-only authentication flow.
export default function AdminLogin() {
  return <Navigate to="/login" replace />;
}
