import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    firstName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    firstName?: string | null;
  }
}
