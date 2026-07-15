import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { getProfile, updateProfile, type UpdateProfilePayload } from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";

function createSchema(t: (key: string) => string) {
  return z
  .object({
    firstName: z.string().trim().min(1, t("profileEditor.validation.firstNameRequired")),
    lastName: z.string().trim().min(1, t("profileEditor.validation.lastNameRequired")),
    displayName: z.string().trim().max(100, t("profileEditor.validation.displayNameTooLong")).optional(),
    avatarUrl: z.string().trim().max(500, t("profileEditor.validation.avatarUrlTooLong")).optional(),
    phone: z.string().trim().max(50, t("profileEditor.validation.phoneTooLong")).optional(),
    dateOfBirth: z.string().optional(),
    countryCode: z.string().trim().max(2, t("profileEditor.validation.countryCode")).optional(),
    city: z.string().trim().max(100, t("profileEditor.validation.cityTooLong")).optional(),
    postalCode: z.string().trim().max(20, t("profileEditor.validation.postalCodeTooLong")).optional(),
    street: z.string().trim().max(120, t("profileEditor.validation.streetTooLong")).optional(),
    houseNumber: z.string().trim().max(20, t("profileEditor.validation.houseNumberTooLong")).optional(),
    apartment: z.string().trim().max(20, t("profileEditor.validation.apartmentTooLong")).optional(),
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
      message: t("profileEditor.validation.employmentEndBeforeStart")
    }
  );
}

type FormValues = z.infer<ReturnType<typeof createSchema>>;

export function SettingsProfilePage() {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: getProfile,
    initialData: user?.profile ?? undefined
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: toFormValues(profileQuery.data)
  });

  useEffect(() => {
    form.reset(toFormValues(profileQuery.data));
  }, [form, profileQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: async (nextProfile) => {
      queryClient.setQueryData(queryKeys.profile(), nextProfile);
      await refreshCurrentUser();
      setSuccessMessage(t("profileEditor.updated"));
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty && !mutation.isPending
  });

  if (profileQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (profileQuery.error) {
    return <ScreenMessage title={t("profileEditor.unavailableTitle")} description={getApiError(profileQuery.error).message} />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={t("profileEditor.title")}
        fallbackHref="/profile"
        onBack={() => confirmOrRun(safeBack)}
      />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          setSuccessMessage(null);
          await mutation.mutateAsync(toProfilePayload(values));
        })}
      >
        <ProfileFormSection title={t("profileEditor.basicInformation")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t("profileEditor.fields.firstName")} error={form.formState.errors.firstName?.message} {...form.register("firstName")} />
            <Input label={t("profileEditor.fields.lastName")} error={form.formState.errors.lastName?.message} {...form.register("lastName")} />
          </div>
          <Input label={t("profileEditor.fields.displayName")} error={form.formState.errors.displayName?.message} {...form.register("displayName")} />
          <Input label={t("profileEditor.fields.avatarUrl")} error={form.formState.errors.avatarUrl?.message} {...form.register("avatarUrl")} />
          <Input label={t("profileEditor.fields.phone")} error={form.formState.errors.phone?.message} {...form.register("phone")} />
          <Input
            type="date"
            wrapperClassName="mx-auto w-full max-w-[15rem]"
            label={t("profileEditor.fields.dateOfBirth")}
            error={form.formState.errors.dateOfBirth?.message}
            {...form.register("dateOfBirth")}
          />
        </ProfileFormSection>

        <ProfileFormSection title={t("profileEditor.employment")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="date"
              wrapperClassName="mx-auto w-full max-w-[15rem]"
              label={t("profileEditor.fields.employmentStart")}
              error={form.formState.errors.employmentStartDate?.message}
              {...form.register("employmentStartDate")}
            />
            <Input
              type="date"
              wrapperClassName="mx-auto w-full max-w-[15rem]"
              label={t("profileEditor.fields.employmentEnd")}
              error={form.formState.errors.employmentEndDate?.message}
              {...form.register("employmentEndDate")}
            />
          </div>
        </ProfileFormSection>

        <ProfileFormSection title={t("profileEditor.address")}>
          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
            <Input label={t("profileEditor.fields.countryCode")} error={form.formState.errors.countryCode?.message} {...form.register("countryCode")} />
            <Input label={t("profileEditor.fields.city")} error={form.formState.errors.city?.message} {...form.register("city")} />
          </div>
          <Input label={t("profileEditor.fields.postalCode")} error={form.formState.errors.postalCode?.message} {...form.register("postalCode")} />
          <Input label={t("profileEditor.fields.street")} error={form.formState.errors.street?.message} {...form.register("street")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t("profileEditor.fields.houseNumber")} error={form.formState.errors.houseNumber?.message} {...form.register("houseNumber")} />
            <Input label={t("profileEditor.fields.apartment")} error={form.formState.errors.apartment?.message} {...form.register("apartment")} />
          </div>
        </ProfileFormSection>

        <SettingsFormActions submitting={mutation.isPending} successMessage={successMessage} />
        {!successMessage && mutation.error ? (
          <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
        ) : null}
      </form>
      {dialog}
    </div>
  );
}

function ProfileFormSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <p className="hairline-text">{title}</p>
      <div className="dashboard-glass-card space-y-4 p-5">
        {children}
      </div>
    </section>
  );
}

function toFormValues(profile: Awaited<ReturnType<typeof getProfile>> | null | undefined): FormValues {
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
	    displayName: profile?.displayName ?? "",
	    avatarUrl: profile?.avatarUrl ?? "",
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
    avatarUrl: normalizeOptional(values.avatarUrl),
    phone: normalizeOptional(values.phone),
    dateOfBirth: normalizeOptional(values.dateOfBirth),
    countryCode: normalizeOptional(values.countryCode)?.toUpperCase() ?? null,
    city: normalizeOptional(values.city),
    postalCode: normalizeOptional(values.postalCode),
    street: normalizeOptional(values.street),
    houseNumber: normalizeOptional(values.houseNumber),
    apartment: normalizeOptional(values.apartment),
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
