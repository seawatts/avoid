'use client';

import { MetricButton } from '@acme/analytics/components';
import { useIsEntitled } from '@acme/stripe/guards/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@acme/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@acme/ui/tooltip';
import { useOrganization } from '@clerk/nextjs';
import { IconInfoCircle } from '@tabler/icons-react';
import { useAction } from 'next-safe-action/hooks';
import { createCheckoutSessionAction } from '~/app/(app)/app/settings/billing/actions';

// Common tooltip component
function UsageTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconInfoCircle className="size-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">
            Upgrade your plan to unlock additional features and higher usage
            limits.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Common card header component
function UsageCardHeader({
  planName,
  description,
}: {
  planName?: string;
  description?: string;
}) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Plan Status</CardTitle>
          <UsageTooltip />
        </div>
        {planName && (
          <span className="text-xs text-muted-foreground">{planName}</span>
        )}
      </div>
      {description && (
        <CardDescription className="text-xs">{description}</CardDescription>
      )}
    </CardHeader>
  );
}

// Plan status display component
function PlanStatusDisplay() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Current Plan</span>
        <span className="font-medium">Free Plan</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Basic features included
      </div>
    </div>
  );
}

export function UsageCard() {
  const { organization } = useOrganization();
  const isEntitled = useIsEntitled('unlimited_webhook_events');

  const { executeAsync: executeCreateCheckout, status: checkoutStatus } =
    useAction(createCheckoutSessionAction);

  const isSubscribing = checkoutStatus === 'executing';

  const handleUpgrade = async () => {
    if (!organization?.id) return;

    try {
      await executeCreateCheckout();
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };

  if (isEntitled) {
    return null;
  }

  return (
    <Card className="mx-2 border-border/50 bg-card/50 shadow-none">
      <UsageCardHeader
        description="Upgrade to unlock premium features"
        planName="Free Plan"
      />
      <CardContent>
        <div className="space-y-3">
          <PlanStatusDisplay />
          <MetricButton
            className="w-full"
            disabled={isSubscribing}
            metric="usage_card_upgrade_clicked"
            onClick={handleUpgrade}
            size="sm"
            variant="secondary"
          >
            {isSubscribing ? 'Redirecting...' : 'Upgrade For Premium Features'}
          </MetricButton>
        </div>
      </CardContent>
    </Card>
  );
}
