"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { getMe, logout } from "@/lib/api";

export default function Home() {
  // undefined while checking the session, null when signed out
  const [user, setUser] = useState<string | null>();

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  if (user === undefined) {
    return null;
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return <KanbanBoard onLogout={handleLogout} />;
}
