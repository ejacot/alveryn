import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { getProfile, updateProfile, type UpdateProfilePayload } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsSection } from "../components/settings/settings-section";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";
import { useAuth } from "../features/auth/use-auth";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import type { EmploymentType } from "../types/configuration";

const employmentTypes: EmploymentType[] = ["FULL_TIME", "PART_TIME", "MINI_JOB", "FREELANCE", "CONTRACTOR", "OTHER"];

const schema = z
  .object({
    employmentType: z.enum(employmentTypes),
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

export function SettingsEmploymentPage() {
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
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

  useEffect(() => {
    let frameId = 0;

    const updateCompactTitle = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const titleRect = largeTitleRef.current?.getBoundingClientRect();
        const buttonRect = backButtonRef.current?.getBoundingClientRect();

        if (!titleRect || !buttonRect) {
          setCompactTitleVisible(false);
          return;
        }

        setCompactTitleVisible(titleRect.top <= buttonRect.top);
      });
    };

    updateCompactTitle();
    window.addEventListener("scroll", updateCompactTitle, { passive: true });
    window.addEventListener("resize", updateCompactTitle);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateCompactTitle);
      window.removeEventListener("resize", updateCompactTitle);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateProfile(toProfilePayload(profileQuery.data, values)),
    onSuccess: async (nextProfile) => {
      queryClient.setQueryData(queryKeys.profile(), nextProfile);
      await refreshCurrentUser();
      setSuccessMessage(t("common:messages.changesSaved"));
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
    return <ScreenMessage title={t("settings:profileEditor.employment")} description={getApiError(profileQuery.error).message} />;
  }

  const title = t("settings:profileEditor.employment");

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-8 pb-10 pt-12">
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex h-[7.25rem] w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={() => confirmOrRun(safeBack)}
          aria-label={t("common:actions.back")}
          className="mt-[3.25rem] flex h-10 items-center gap-1.5 rounded-md px-0 text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>{t("common:actions.back")}</span>
        </button>
        <div
          className={`pointer-events-none absolute left-1/2 top-[3.75rem] flex h-10 -translate-x-1/2 items-center text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0 delay-0"
          }`}
          aria-hidden="true"
        >
          {title}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.8rem] font-semibold leading-none tracking-[-0.08em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {title}
      </h1>

      <SettingsContextCard context="employment" />

      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          setSuccessMessage(null);
          await mutation.mutateAsync(values);
        })}
      >
        <SettingsSection title={title}>
          <div className="space-y-4">
            <Select label={t("settings:profileEditor.fields.employmentType")} error={form.formState.errors.employmentType?.message} {...form.register("employmentType")}>
              {employmentTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`settings:profileEditor.employmentTypes.${type}`)}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              className="!mx-0 !max-w-none !rounded-2xl !text-left !text-base !font-normal"
              label={t("settings:profileEditor.fields.employmentStart")}
              error={form.formState.errors.employmentStartDate?.message}
              {...form.register("employmentStartDate")}
            />
            <Input
              type="date"
              className="!mx-0 !max-w-none !rounded-2xl !text-left !text-base !font-normal"
              label={t("settings:profileEditor.fields.employmentEnd")}
              error={form.formState.errors.employmentEndDate?.message}
              {...form.register("employmentEndDate")}
            />
          </div>
        </SettingsSection>

        <SettingsFormActions submitting={mutation.isPending} successMessage={successMessage} />
        {!successMessage && mutation.error ? (
          <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
        ) : null}
      </form>
      {dialog}
    </div>
  );
}

function toFormValues(profile: Awaited<ReturnType<typeof getProfile>> | null | undefined): FormValues {
  return {
    employmentType: profile?.employmentType ?? "FULL_TIME",
    employmentStartDate: profile?.employmentStartDate ?? "",
    employmentEndDate: profile?.employmentEndDate ?? ""
  };
}

function toProfilePayload(
  profile: Awaited<ReturnType<typeof getProfile>> | null | undefined,
  values: FormValues
): UpdateProfilePayload {
  return {
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    displayName: profile?.displayName ?? null,
    dateOfBirth: profile?.dateOfBirth ?? null,
    phone: profile?.phone ?? null,
    countryCode: profile?.countryCode ?? null,
    city: profile?.city ?? null,
    postalCode: profile?.postalCode ?? null,
    street: profile?.street ?? null,
    houseNumber: profile?.houseNumber ?? null,
    apartment: profile?.apartment ?? null,
    addressId: profile?.addressId ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    employmentType: values.employmentType,
    employmentStartDate: normalizeOptional(values.employmentStartDate),
    employmentEndDate: normalizeOptional(values.employmentEndDate)
  };
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
