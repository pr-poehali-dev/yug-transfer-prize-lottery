import { useEffect, useState } from "react";
import { PostsDashboard } from "@/components/admin/PostsDashboard";
import { POSTS_SESSION_KEY } from "@/components/admin/adminTypes";

export default function Posts() {
  const [token] = useState(() => sessionStorage.getItem(POSTS_SESSION_KEY) || "");

  useEffect(() => {
    if (!token) window.location.replace("/");
  }, [token]);

  const handleLogout = () => { sessionStorage.removeItem(POSTS_SESSION_KEY); window.location.href = "/"; };

  if (!token) return null;
  return <PostsDashboard token={token} onLogout={handleLogout} />;
}
