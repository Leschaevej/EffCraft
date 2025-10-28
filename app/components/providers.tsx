"use client";

import { SessionProvider } from "next-auth/react";
import { RealtimeProvider } from "../context/Realtime";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RealtimeProvider>
        {children}
      </RealtimeProvider>
    </SessionProvider>
  );
}