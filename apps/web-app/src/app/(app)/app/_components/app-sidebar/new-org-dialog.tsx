'use client';

import { MetricButton, MetricLink } from '@acme/analytics/components';
import { api } from '@acme/api/react';
import {
  Entitled,
  NotEntitled,
  useIsEntitled,
} from '@acme/stripe/guards/client';
import { Button } from '@acme/ui/components/button';
import { P } from '@acme/ui/custom/typography';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@acme/ui/dialog';
import { Input } from '@acme/ui/input';
import { Label } from '@acme/ui/label';
import { useOrganizationList, useUser } from '@clerk/nextjs';
import { IconLoader2 } from '@tabler/icons-react';
import { useState } from 'react';

interface NewOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOrgDialog({ open, onOpenChange }: NewOrgDialogProps) {
  const [name, setName] = useState('');
  const { setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  });

  const [errors, setErrors] = useState<string[]>([]);
  const { user } = useUser();
  const isEntitled = useIsEntitled('unlimited_developers');

  const apiUtils = api.useUtils();

  // API mutations
  const { mutateAsync: createOrganization, isPending: isCreatingOrg } =
    api.org.upsert.useMutation();

  const isLoading = isCreatingOrg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!user?.id) {
      setErrors(['User not authenticated']);
      return;
    }

    try {
      // Use the tRPC API to create a new organization with Stripe integration
      // This will automatically create a Stripe customer, subscribe to the free plan, and create an API key
      const orgResult = await createOrganization({
        name: name,
      });

      if (!orgResult) {
        throw new Error('Failed to create organization');
      }

      console.log('Organization created with Stripe integration:', {
        apiKeyId: orgResult.apiKey?.id,
        orgId: orgResult.org.id,
        orgName: orgResult.org.name,
        stripeCustomerId: orgResult.org.stripeCustomerId,
      });

      // Set the new organization as active
      if (!setActive) return;

      await setActive({
        organization: orgResult.org.id,
      });

      // Close dialog and reset form
      onOpenChange(false);
      setName('');
      setErrors([]);

      // Invalidate queries to refresh data
      apiUtils.invalidate();
      userMemberships.revalidate();
    } catch (error) {
      console.error('Failed to complete setup:', error);
      setErrors([
        error instanceof Error
          ? error.message
          : 'Failed to create organization',
      ]);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Organization</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div>
            <Label className="block mb-2" htmlFor="org-name">
              Organization Name
            </Label>
            <Input
              autoFocus
              disabled={isLoading || !isEntitled}
              id="org-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc"
              required
              value={name}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Choose a name for your organization. Use letters, numbers, and
              spaces.
            </p>
          </div>
          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((error) => (
                <P key={`error-${error}`} variant="destructive">
                  {error}
                </P>
              ))}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <MetricButton
                metric="new_org_dialog_cancel_clicked"
                type="button"
                variant="outline"
              >
                Cancel
              </MetricButton>
            </DialogClose>
            <Entitled entitlement="unlimited_developers">
              <MetricButton
                disabled={isLoading || !name}
                metric="new_org_dialog_create_clicked"
                type="submit"
              >
                {isLoading && (
                  <IconLoader2 className="text-secondary" size="sm" />
                )}
                Create
              </MetricButton>
            </Entitled>
            <NotEntitled entitlement="unlimited_developers">
              <Button asChild>
                <MetricLink
                  href="/app/settings/billing"
                  metric="new_org_dialog_upgrade_clicked"
                  properties={{
                    destination: '/app/settings/billing',
                    location: 'new_org_dialog',
                  }}
                >
                  Upgrade to create organizations
                </MetricLink>
              </Button>
            </NotEntitled>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
