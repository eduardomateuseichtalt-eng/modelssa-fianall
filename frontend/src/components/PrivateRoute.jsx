import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }
  if (!user || user.role !== "MODEL") {
    return <Navigate to="/modelo/login" replace />;
  }

  return children;
}
