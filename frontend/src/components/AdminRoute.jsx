import { Navigate } from "react-router-dom";

const ADMIN_EMAIL = "eduardomateuseichtalt@gmail.com";

export default function AdminRoute({ children }) {
  const token = localStorage.getItem("accessToken");
  const storedUser = localStorage.getItem("user");
  let user = null;

  try {
    if (storedUser && storedUser !== "undefined") {
      user = JSON.parse(storedUser);
    }
  } catch {
    user = null;
  }

  if (!token || !user || user.role !== "ADMIN" || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
