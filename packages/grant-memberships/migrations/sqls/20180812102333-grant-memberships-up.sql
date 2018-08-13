CREATE TABLE "membershipGrantCampaigns" (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    interval "intervalType" NOT NULL DEFAULT 'month'::"intervalType",
    "intervalCount" integer NOT NULL DEFAULT 1,
    "beginAt" timestamp with time zone NOT NULL DEFAULT now() + '1 mon'::interval,
    "endAt" timestamp with time zone NOT NULL DEFAULT now() + '2 mons'::interval,
    constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "endAt_after_beginAt" CHECK ("endAt" > "beginAt")
);

CREATE TABLE "membershipGrants" (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "membershipGrantCampaignId" uuid REFERENCES "membershipGrantCampaigns"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "granteeUserId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    email citext,
    "recipientUserId" uuid REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "beginAt" timestamp with time zone NOT NULL,
    "endAt" timestamp with time zone NOT NULL,
    "revokedAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "endAt_after_beginAt" CHECK ("endAt" > "beginAt")
);
