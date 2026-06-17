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
import { prisma } from "@vaultlier/db";
import { logAudit } from "./audit";
import {
  sendOrganizationInvitationAcceptedEmail,
  sendOrganizationMemberAddedEmail,
  sendWelcomeEmail,
} from "./email-notifications";

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
      if (user.email) {
        await sendWelcomeEmail({ to: user.email, name: user.name });
      }
    },
    async signIn({ user }) {
      if (!user.id || !user.email) return;
      const email = user.email.toLowerCase();
      const invitations = await prisma.organizationInvitation.findMany({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          organization: { select: { name: true } },
          invitedBy: { select: { email: true, name: true } },
        },
      });
      if (invitations.length === 0) return;

      await prisma.$transaction(async (tx) => {
        for (const invitation of invitations) {
          await tx.membership.upsert({
            where: {
              userId_organizationId: {
                userId: user.id!,
                organizationId: invitation.organizationId,
              },
            },
            update: {},
            create: {
              userId: user.id!,
              organizationId: invitation.organizationId,
              role: invitation.role,
            },
          });
          await tx.organizationInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
          });
          await logAudit(
            {
              action: "MEMBER_JOINED",
              userId: user.id,
              organizationId: invitation.organizationId,
              metadata: { email, role: invitation.role },
            },
            tx,
          );
        }
      });

      for (const invitation of invitations) {
        await sendOrganizationMemberAddedEmail({
          to: email,
          name: user.name,
          organizationName: invitation.organization.name,
          organizationId: invitation.organizationId,
          role: invitation.role,
        });
        if (invitation.invitedBy.email) {
          await sendOrganizationInvitationAcceptedEmail({
            to: invitation.invitedBy.email,
            memberName: user.name ?? email,
            memberEmail: email,
            organizationName: invitation.organization.name,
            role: invitation.role,
          });
        }
      }
    },
  },
});

// Explicit annotations: inferred types reference next-auth internals and
// trip TS2742 ("not portable") in a monorepo.
export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
