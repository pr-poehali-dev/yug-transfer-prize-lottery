import { useState } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { SESSION_KEY } from "@/components/admin/adminTypes";

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || "");

  const handleLogout = () => { sessionStorage.removeItem(SESSION_KEY); setToken(""); window.location.href = "/"; };

  if (!token) return <AdminLogin onSuccess={t => setToken(t)} />;
  return <AdminDashboard token={token} onLogout={handleLogout} />;
}