import { useState } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { PostsDashboard } from "@/components/admin/PostsDashboard";
import { POSTS_SESSION_KEY } from "@/components/admin/adminTypes";

export default function Posts() {
  const [token, setToken] = useState(() => sessionStorage.getItem(POSTS_SESSION_KEY) || "");

  const handleLogout = () => { sessionStorage.removeItem(POSTS_SESSION_KEY); setToken(""); window.location.href = "/"; };

  if (!token)
    return (
      <AdminLogin
        scope="posts"
        title="Посты в канал"
        subtitle="Доступ только по отдельному паролю"
        sessionKey={POSTS_SESSION_KEY}
        onSuccess={(t) => setToken(t)}
      />
    );
  return <PostsDashboard token={token} onLogout={handleLogout} />;
}
