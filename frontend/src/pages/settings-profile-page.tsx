import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { getProfile, updateProfile, type UpdateProfilePayload } from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { settingsKeys } from "../features/settings/settings-keys";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsSection } from "../components/settings/settings-section";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";

const schema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    displayName: z.string().trim().max(100, "Display name is too long").optional(),
    phone: z.string().trim().max(50, "Phone is too long").optional(),
    dateOfBirth: z.string().optional(),
    countryCode: z.string().trim().max(2, "Use a two-letter country code").optional(),
    city: z.string().trim().max(100, "City is too long").optional(),
    postalCode: z.string().trim().max(20, "Postal code is too long").optional(),
    street: z.string().trim().max(120, "Street is too long").optional(),
    houseNumber: z.string().trim().max(20, "House number is too long").optional(),
    apartment: z.string().trim().max(20, "Apartment is too long").optional(),
    employmentStartDate: z.string().optional(),
    employmentEndDate: z.string().optional()
  })
  .refine(
    (values) =>
      !values.employmentStartDate ||
      !values.employmentEndDate ||
      values.employmentEndDate >= values.employmentStartDate,
    {
      path: ["employmentEndDate"],
      message: "Employment end cannot be before employment start"
    }
  );

type FormValues = z.infer<typeof schema>;

export function SettingsProfilePage() {
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: settingsKeys.profile(),
    queryFn: getProfile,
    initialData: user?.profile ?? undefined
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profileQuery.data)
  });

  useEffect(() => {
    form.reset(toFormValues(profileQuery.data));
  }, [form, profileQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: async (nextProfile) => {
      queryClient.setQueryData(settingsKeys.profile(), nextProfile);
      await refreshCurrentUser();
      setSuccessMessage("Profile updated.");
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  if (profileQuery.isLoading) {
    return <ScreenMessage title="Loading profile..." description="Bringing in your current information." />;
  }

  if (profileQuery.error) {
    return <ScreenMessage title="Profile is unavailable" description={getApiError(profileQuery.error).message} />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader title="Profile" description="Keep the essentials accurate. Advanced fields stay calm and out of the way." />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          setSuccessMessage(null);
          await mutation.mutateAsync(toProfilePayload(values));
        })}
      >
        <SettingsSection title="Basic information">
          <div className="space-y-4">
            <Input label="First name" error={form.formState.errors.firstName?.message} {...form.register("firstName")} />
            <Input label="Last name" error={form.formState.errors.lastName?.message} {...form.register("lastName")} />
            <Input label="Display name" error={form.formState.errors.displayName?.message} {...form.register("displayName")} />
            <Input label="Phone" error={form.formState.errors.phone?.message} {...form.register("phone")} />
            <Input type="date" label="Date of birth" error={form.formState.errors.dateOfBirth?.message} {...form.register("dateOfBirth")} />
          </div>
        </SettingsSection>

        <SettingsSection title="Employment">
          <div className="space-y-4">
            <Input type="date" label="Employment start" error={form.formState.errors.employmentStartDate?.message} {...form.register("employmentStartDate")} />
            <Input type="date" label="Employment end" error={form.formState.errors.employmentEndDate?.message} {...form.register("employmentEndDate")} />
          </div>
        </SettingsSection>

        <SettingsSection title="Address">
          <div className="space-y-4">
            <Input label="Country code" error={form.formState.errors.countryCode?.message} {...form.register("countryCode")} />
            <Input label="City" error={form.formState.errors.city?.message} {...form.register("city")} />
            <Input label="Postal code" error={form.formState.errors.postalCode?.message} {...form.register("postalCode")} />
            <Input label="Street" error={form.formState.errors.street?.message} {...form.register("street")} />
            <Input label="House number" error={form.formState.errors.houseNumber?.message} {...form.register("houseNumber")} />
            <Input label="Apartment" error={form.formState.errors.apartment?.message} {...form.register("apartment")} />
          </div>
        </SettingsSection>

        <SettingsFormActions submitting={mutation.isPending} successMessage={successMessage} />
        {!successMessage && mutation.error ? (
          <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
        ) : null}
      </form>
    </div>
  );
}

function toFormValues(profile: Awaited<ReturnType<typeof getProfile>> | null | undefined): FormValues {
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    displayName: profile?.displayName ?? "",
    phone: profile?.phone ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    countryCode: profile?.countryCode ?? "",
    city: profile?.city ?? "",
    postalCode: profile?.postalCode ?? "",
    street: profile?.street ?? "",
    houseNumber: profile?.houseNumber ?? "",
    apartment: profile?.apartment ?? "",
    employmentStartDate: profile?.employmentStartDate ?? "",
    employmentEndDate: profile?.employmentEndDate ?? ""
  };
}

function toProfilePayload(values: FormValues): UpdateProfilePayload {
  return {
    firstName: normalizeRequired(values.firstName),
    lastName: normalizeRequired(values.lastName),
    displayName: normalizeOptional(values.displayName),
    phone: normalizeOptional(values.phone),
    dateOfBirth: normalizeOptional(values.dateOfBirth),
    countryCode: normalizeOptional(values.countryCode)?.toUpperCase() ?? null,
    city: normalizeOptional(values.city),
    postalCode: normalizeOptional(values.postalCode),
    street: normalizeOptional(values.street),
    houseNumber: normalizeOptional(values.houseNumber),
    apartment: normalizeOptional(values.apartment),
    avatarUrl: null,
    employmentStartDate: normalizeOptional(values.employmentStartDate),
    employmentEndDate: normalizeOptional(values.employmentEndDate)
  };
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeRequired(value: string) {
  return value.trim();
}
