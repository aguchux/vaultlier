/**
 * Auth.js (NextAuth v5) configuration for the Vaultlier portal.
 *
 * OAuth sign-in with Google and GitHub, persisted through the Prisma adapter
 * (database sessions). Provider credentials come from the standard env vars:
 * AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, AUTH_GITHUB_ID / AUTH_GITHUB_SECRET,
 * plus AUTH_SECRET. See .env.example.
 */

import NextAuth, { type NextAuthResult } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@repo/db";
import { logAudit } from "./audit";

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google, GitHub],
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  events: {
    // First-time sign-in creates a user row — that's a mutation, audit it.
    async createUser({ user }) {
      await logAudit({
        action: "USER_SIGNED_UP",
        userId: user.id,
        metadata: { email: user.email },
      });
    },
  },
});

// Explicit annotations: inferred types reference next-auth internals and
// trip TS2742 ("not portable") in a monorepo.
export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
