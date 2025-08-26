'use client';

import { api } from '@acme/api/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@acme/ui/card';
import { Button } from '@acme/ui/components/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@acme/ui/components/form';
import { Input } from '@acme/ui/components/input';
import { Icons } from '@acme/ui/custom/icons';
import { cn } from '@acme/ui/lib/utils';
import { toast } from '@acme/ui/sonner';
import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Constants
const VALIDATION_REGEX = /^[a-z0-9-_]+$/;
const DEBOUNCE_DELAY = 500;

// Validation utilities
const validateNameFormat = (name: string, minLength: number) => {
  if (name.length < minLength) return null;
  if (!VALIDATION_REGEX.test(name)) {
    return 'Name can only contain lowercase letters, numbers, hyphens, and underscores';
  }
  return null;
};

// Validation state type
interface ValidationState {
  checking: boolean;
  available: boolean | null;
  message: string;
}

// Custom hook for name validation
function useNameValidation(
  name: string,
  minLength: number,
  checkAvailability: (
    name: string,
  ) => Promise<{ available: boolean | string | undefined; message: string }>,
) {
  const [validation, setValidation] = useState<ValidationState>({
    available: null,
    checking: false,
    message: '',
  });

  const validate = useCallback(
    async (nameToValidate: string) => {
      console.log(
        'Validating name:',
        nameToValidate,
        'with minLength:',
        minLength,
      );

      // Early return for empty or too short names
      if (nameToValidate.length < minLength) {
        console.log('Name too short, clearing validation');
        setValidation({ available: null, checking: false, message: '' });
        return;
      }

      // Check format validity
      const formatError = validateNameFormat(nameToValidate, minLength);
      if (formatError) {
        console.log('Format error:', formatError);
        setValidation({
          available: null,
          checking: false,
          message: formatError,
        });
        return;
      }

      console.log('Starting availability check for:', nameToValidate);
      setValidation({ available: null, checking: true, message: '' });

      try {
        const result = await checkAvailability(nameToValidate);
        console.log('Availability result:', result);

        // Handle different response types from different endpoints
        let available: boolean | null = null;
        if (typeof result.available === 'boolean') {
          available = result.available;
        } else if (result.available === '') {
          available = false;
        } else if (result.available === undefined) {
          available = null;
        }

        setValidation({
          available,
          checking: false,
          message: result.message,
        });
      } catch (error) {
        console.error('Validation error:', error);
        setValidation({
          available: false,
          checking: false,
          message: 'Failed to check availability',
        });
      }
    },
    [minLength, checkAvailability],
  );

  // Debounced validation effect
  useEffect(() => {
    if (!name || name.length < minLength) {
      setValidation({ available: null, checking: false, message: '' });
      return;
    }

    // Check format validity immediately
    const formatError = validateNameFormat(name, minLength);
    if (formatError) {
      setValidation({
        available: null,
        checking: false,
        message: formatError,
      });
      return;
    }

    const timer = setTimeout(() => {
      validate(name);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [name, minLength, validate]);

  return validation;
}

const onboardingSchema = z.object({
  orgName: z
    .string()
    .min(3, 'Organization name must be at least 3 characters')
    .max(50, 'Organization name must be less than 50 characters')
    .regex(
      VALIDATION_REGEX,
      'Organization name can only contain lowercase letters, numbers, hyphens, and underscores',
    )
    .transform((val) => val.toLowerCase().trim()),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

interface OnboardingFormProps {
  isLoading?: boolean;
  redirectTo?: string;
  source?: string;
}

export function OnboardingForm({
  isLoading = false,
  redirectTo,
  source,
}: OnboardingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { organization } = useOrganization();
  const { setActive } = useOrganizationList({ userMemberships: true });
  const { user } = useUser();

  const form = useForm<OnboardingFormData>({
    defaultValues: {
      orgName: '',
    },
    mode: 'onChange',
    resolver: zodResolver(onboardingSchema),
  });

  const { watch } = form;
  const orgName = watch('orgName');

  // Use tRPC utils for API calls
  const apiUtils = api.useUtils();

  // Validation hooks
  const orgNameValidation = useNameValidation(
    orgName,
    3,
    useCallback(
      (name) =>
        apiUtils.org.checkNameAvailability.fetch({
          excludeOrgId: organization?.id,
          name,
        }),
      [apiUtils.org.checkNameAvailability, organization?.id],
    ),
  );

  const { mutateAsync: createOrganization } = api.org.upsert.useMutation();

  const handleSubmit = async (data: OnboardingFormData) => {
    if (!user) {
      toast.error('No user found');
      return;
    }

    // Check validation status before submitting
    if (orgNameValidation.available === false) {
      toast.error('Please fix organization name validation errors');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create organization with Stripe integration
      const orgResult = await createOrganization({
        name: data.orgName,
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

      // Update existing Clerk organization if it exists
      if (organization) {
        try {
          await organization.update({
            name: data.orgName,
          });
          console.log('Organization name updated in Clerk successfully');

          await organization.reload();

          console.log('Organization context reloaded successfully');
        } catch (error) {
          console.error('Failed to update organization in Clerk:', error);
          // Continue with the flow even if Clerk update fails
        }
      } else {
        console.log(
          'No existing Clerk organization to update - this is expected during onboarding',
        );
      }

      if (setActive) {
        await setActive({ organization: orgResult.org.id });
      }

      toast.success('Setup complete!', {
        description:
          'Organization activated successfully. Redirecting to your dashboard...',
      });

      // Redirect to success page
      const params = new URLSearchParams({
        orgName: data.orgName,
      });

      if (redirectTo) {
        params.append('redirectTo', redirectTo);
      }
      if (source) {
        params.append('source', source);
      }

      router.push(`/app/onboarding/success?${params.toString()}`);
    } catch (error) {
      console.error('Failed to complete setup:', error);
      toast.error('Failed to complete setup', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to render validation icon
  const renderValidationIcon = (validation: ValidationState) => {
    if (validation.checking) {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Icons.Spinner className="animate-spin" size="sm" variant="muted" />
        </div>
      );
    }

    if (validation.available === true) {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Icons.Check className="text-green-500" size="sm" />
        </div>
      );
    }

    if (validation.available === false) {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Icons.X size="sm" variant="destructive" />
        </div>
      );
    }

    return null;
  };

  // Helper function to get input border classes
  const getInputBorderClasses = (validation: ValidationState) => {
    return cn(
      validation.checking && 'pr-10',
      validation.available === false && 'border-destructive',
      validation.available === true && 'border-green-500',
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Acme! 🎉</CardTitle>
          <CardDescription>
            Let's set up your organization. Choose a name for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-6"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="orgName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="e.g., my-company"
                            {...field}
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            autoFocus
                            autoSave="off"
                            className={getInputBorderClasses(orgNameValidation)}
                            disabled={isSubmitting || isLoading}
                          />
                          {renderValidationIcon(orgNameValidation)}
                        </div>
                      </FormControl>
                      <FormDescription>
                        This will be your organization name. Use lowercase
                        letters, numbers, and hyphens only.
                      </FormDescription>
                      {orgNameValidation.available === false &&
                        orgNameValidation.message && (
                          <p className="text-sm text-destructive">
                            {orgNameValidation.message}
                          </p>
                        )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    className="min-w-32"
                    disabled={
                      isSubmitting ||
                      isLoading ||
                      !orgName ||
                      orgNameValidation.available === false
                    }
                    type="submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Icons.Spinner
                          className="animate-spin mr-2"
                          size="sm"
                        />
                        Setting up...
                      </>
                    ) : (
                      'Create Organization'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
