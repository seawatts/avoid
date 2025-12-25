import { relations } from 'drizzle-orm';

// Import all tables
import { Accounts } from './accounts';
import { ApiKeys, ApiKeyUsage, AuthCodes } from './api-keys';
import { Invitations, OrgMembers, Orgs } from './organizations';
import { Sessions } from './sessions';
import { ShortUrls } from './short-urls';

import { Users } from './users';

// ============================================================================
// USER RELATIONS
// ============================================================================

export const UsersRelations = relations(Users, ({ many }) => ({
  accounts: many(Accounts),
  apiKeys: many(ApiKeys),
  apiKeyUsage: many(ApiKeyUsage),
  authCodes: many(AuthCodes),
  orgMembers: many(OrgMembers),
  sessions: many(Sessions),
}));

// ============================================================================
// SESSION RELATIONS
// ============================================================================

export const SessionsRelations = relations(Sessions, ({ one }) => ({
  activeOrganization: one(Orgs, {
    fields: [Sessions.activeOrganizationId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [Sessions.userId],
    references: [Users.id],
  }),
}));

// ============================================================================
// ACCOUNT RELATIONS
// ============================================================================

export const AccountsRelations = relations(Accounts, ({ one }) => ({
  user: one(Users, {
    fields: [Accounts.userId],
    references: [Users.id],
  }),
}));

// ============================================================================
// ORGANIZATION RELATIONS
// ============================================================================

export const OrgsRelations = relations(Orgs, ({ many }) => ({
  apiKeys: many(ApiKeys),
  apiKeyUsage: many(ApiKeyUsage),
  authCodes: many(AuthCodes),
  invitations: many(Invitations),
  members: many(OrgMembers),
  sessions: many(Sessions),
}));

export const OrgMembersRelations = relations(OrgMembers, ({ one }) => ({
  organization: one(Orgs, {
    fields: [OrgMembers.organizationId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [OrgMembers.userId],
    references: [Users.id],
  }),
}));

export const InvitationsRelations = relations(Invitations, ({ one }) => ({
  inviter: one(Users, {
    fields: [Invitations.inviterId],
    references: [Users.id],
  }),
  organization: one(Orgs, {
    fields: [Invitations.organizationId],
    references: [Orgs.id],
  }),
}));

// ============================================================================
// AUTH CODE RELATIONS
// ============================================================================

export const AuthCodesRelations = relations(AuthCodes, ({ one }) => ({
  organization: one(Orgs, {
    fields: [AuthCodes.organizationId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [AuthCodes.userId],
    references: [Users.id],
  }),
}));

// ============================================================================
// API KEY RELATIONS
// ============================================================================

export const ApiKeysRelations = relations(ApiKeys, ({ one, many }) => ({
  organization: one(Orgs, {
    fields: [ApiKeys.organizationId],
    references: [Orgs.id],
  }),
  usage: many(ApiKeyUsage),
  user: one(Users, {
    fields: [ApiKeys.userId],
    references: [Users.id],
  }),
}));

export const ApiKeyUsageRelations = relations(ApiKeyUsage, ({ one }) => ({
  apiKey: one(ApiKeys, {
    fields: [ApiKeyUsage.apiKeyId],
    references: [ApiKeys.id],
  }),
  organization: one(Orgs, {
    fields: [ApiKeyUsage.organizationId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [ApiKeyUsage.userId],
    references: [Users.id],
  }),
}));

// ============================================================================
// SHORT URL RELATIONS
// ============================================================================

export const ShortUrlsRelations = relations(ShortUrls, ({ one }) => ({
  organization: one(Orgs, {
    fields: [ShortUrls.organizationId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [ShortUrls.userId],
    references: [Users.id],
  }),
}));
