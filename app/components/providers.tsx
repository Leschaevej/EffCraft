"use client";

import { SessionProvider } from "next-auth/react";
import { ReservationProvider } from "../context/ReservationContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ReservationProvider>
        {children}
      </ReservationProvider>
    </SessionProvider>
  );
}