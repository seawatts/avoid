import { z } from 'zod';

import { schema } from './common';

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = schema.enum('userRole', [
  'admin',
  'owner',
  'member',
]);
export const localConnectionStatusEnum = schema.enum('localConnectionStatus', [
  'connected',
  'disconnected',
]);
export const stripeSubscriptionStatusEnum = schema.enum(
  'stripeSubscriptionStatus',
  [
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'paused',
    'trialing',
    'unpaid',
  ],
);
export const apiKeyUsageTypeEnum = schema.enum('apiKeyUsageType', [
  'mcp-server',
]);
export const invitationStatusEnum = schema.enum('invitationStatus', [
  'pending',
  'accepted',
  'rejected',
  'canceled',
]);
// ============================================================================
// ZOD TYPES FROM ENUMS
// ============================================================================

export const UserRoleType = z.enum(userRoleEnum.enumValues).enum;
export const LocalConnectionStatusType = z.enum(
  localConnectionStatusEnum.enumValues,
).enum;
export const StripeSubscriptionStatusType = z.enum(
  stripeSubscriptionStatusEnum.enumValues,
).enum;
export const ApiKeyUsageTypeType = z.enum(apiKeyUsageTypeEnum.enumValues).enum;
export const InvitationStatusType = z.enum(
  invitationStatusEnum.enumValues,
).enum;
