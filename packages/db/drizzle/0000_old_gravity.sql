CREATE SCHEMA IF NOT EXISTS "startup_template";
--> statement-breakpoint
CREATE TYPE "startup_template"."apiKeyUsageType" AS ENUM('mcp-server');--> statement-breakpoint
CREATE TYPE "startup_template"."invitationStatus" AS ENUM('pending', 'accepted', 'rejected', 'canceled');--> statement-breakpoint
CREATE TYPE "startup_template"."localConnectionStatus" AS ENUM('connected', 'disconnected');--> statement-breakpoint
CREATE TYPE "startup_template"."stripeSubscriptionStatus" AS ENUM('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'paused', 'trialing', 'unpaid');--> statement-breakpoint
CREATE TYPE "startup_template"."userRole" AS ENUM('admin', 'owner', 'member');--> statement-breakpoint
CREATE TABLE "startup_template"."account" (
	"accessToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"accountId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"idToken" text,
	"password" text,
	"providerId" text NOT NULL,
	"refreshToken" text,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"updatedAt" timestamp with time zone,
	"userId" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_template"."verification" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updatedAt" timestamp with time zone,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_template"."apiKeyUsage" (
	"apiKeyId" varchar(128) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"metadata" json,
	"organizationId" varchar(128) NOT NULL,
	"type" "startup_template"."apiKeyUsageType" NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_template"."apiKeys" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"key" text NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"name" text NOT NULL,
	"organizationId" varchar(128) NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar(128) NOT NULL,
	CONSTRAINT "apiKeys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "startup_template"."authCodes" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organizationId" varchar(128) NOT NULL,
	"sessionId" text NOT NULL,
	"updatedAt" timestamp with time zone,
	"usedAt" timestamp with time zone,
	"userId" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_template"."invitation" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"inviterId" varchar(128) NOT NULL,
	"organizationId" varchar(128) NOT NULL,
	"role" "startup_template"."userRole" DEFAULT 'member' NOT NULL,
	"status" "startup_template"."invitationStatus" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_template"."member" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organizationId" varchar(128) NOT NULL,
	"role" "startup_template"."userRole" DEFAULT 'member' NOT NULL,
	"userId" varchar(128) NOT NULL,
	CONSTRAINT "member_userId_organizationId_unique" UNIQUE("userId","organizationId")
);
--> statement-breakpoint
CREATE TABLE "startup_template"."organization" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"logo" text,
	"metadata" json,
	"name" text NOT NULL,
	"slug" text,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"stripeSubscriptionStatus" "startup_template"."stripeSubscriptionStatus",
	"updatedAt" timestamp with time zone,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "startup_template"."session" (
	"activeOrganizationId" varchar(128),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"ipAddress" text,
	"token" text NOT NULL,
	"updatedAt" timestamp with time zone,
	"userAgent" text,
	"userId" varchar(128) NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "startup_template"."shortUrls" (
	"code" varchar(128) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"organizationId" varchar(128) NOT NULL,
	"redirectUrl" text NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_template"."user" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"image" text,
	"lastLoginMethod" text,
	"name" text NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "startup_template"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."apiKeyUsage" ADD CONSTRAINT "apiKeyUsage_apiKeyId_apiKeys_id_fk" FOREIGN KEY ("apiKeyId") REFERENCES "startup_template"."apiKeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."apiKeyUsage" ADD CONSTRAINT "apiKeyUsage_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "startup_template"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."apiKeyUsage" ADD CONSTRAINT "apiKeyUsage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."apiKeys" ADD CONSTRAINT "apiKeys_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "startup_template"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."apiKeys" ADD CONSTRAINT "apiKeys_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."authCodes" ADD CONSTRAINT "authCodes_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "startup_template"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."authCodes" ADD CONSTRAINT "authCodes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."invitation" ADD CONSTRAINT "invitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."invitation" ADD CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "startup_template"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."member" ADD CONSTRAINT "member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "startup_template"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."member" ADD CONSTRAINT "member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."session" ADD CONSTRAINT "session_activeOrganizationId_organization_id_fk" FOREIGN KEY ("activeOrganizationId") REFERENCES "startup_template"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."shortUrls" ADD CONSTRAINT "shortUrls_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "startup_template"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_template"."shortUrls" ADD CONSTRAINT "shortUrls_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "startup_template"."user"("id") ON DELETE cascade ON UPDATE no action;