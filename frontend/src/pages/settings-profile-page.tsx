import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import {
  changePassword,
  getProfile,
  updateProfile,
  type UpdateProfilePayload
} from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsGroup, SettingsRow } from "../components/settings/settings-group";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Card } from "../components/ui/card";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import type { EmploymentType } from "../types/configuration";

const employmentTypes: EmploymentType[] = ["FULL_TIME", "PART_TIME", "MINI_JOB", "FREELANCE", "CONTRACTOR", "OTHER"];

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
    addressId: z.string().optional(),
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
      message: t("profileEditor.validation.employmentEndBeforeStart")
    }
  );
}

type FormValues = z.infer<ReturnType<typeof createSchema>>;

function createPasswordSchema(t: (key: string) => string) {
  return z.object({
    currentPassword: z.string().min(1, t("profileEditor.password.currentRequired")),
    newPassword: z.string().min(8, t("profileEditor.password.minimumLength")).max(128),
    confirmPassword: z.string().min(1, t("profileEditor.password.confirmRequired"))
  }).refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: t("profileEditor.password.mismatch")
  });
}

type PasswordFormValues = z.infer<ReturnType<typeof createPasswordSchema>>;
type ProfileSection = "overview" | "personal" | "security" | "email" | "phone" | "password" | "payment" | "subscriptions";

export function SettingsProfilePage() {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>("overview");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
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
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(createPasswordSchema(t)),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
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
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      passwordForm.reset();
      setPasswordSuccessMessage(t("profileEditor.password.changed"));
    }
  });
  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty:
      (activeSection === "personal" && form.formState.isDirty && !mutation.isPending) ||
      (activeSection === "password" && passwordForm.formState.isDirty && !passwordMutation.isPending)
  });

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

  if (profileQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (profileQuery.error) {
    return <ScreenMessage title={t("profileEditor.unavailableTitle")} description={getApiError(profileQuery.error).message} />;
  }

  const profile = profileQuery.data;
  const fullName =
    [profile?.firstName, profile?.lastName]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(" ") ||
    profile?.displayName?.trim() ||
    user?.account.email ||
    "Alveryn";
  const initials =
    [profile?.firstName, profile?.lastName]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .slice(0, 2)
      .map((value) => value.charAt(0).toUpperCase())
      .join("") ||
    user?.account.email.slice(0, 2).toUpperCase() ||
    "AV";
  const title =
    activeSection === "personal"
      ? t("profileEditor.menu.personalInformation")
    : activeSection === "security"
      ? t("profileEditor.menu.signInSecurity")
      : activeSection === "email"
        ? t("profileEditor.menu.email")
        : activeSection === "phone"
          ? t("profileEditor.menu.phoneNumber")
          : activeSection === "password"
            ? t("profileEditor.menu.changePassword")
        : activeSection === "payment"
          ? t("profileEditor.menu.paymentShipping")
          : activeSection === "subscriptions"
            ? t("profileEditor.menu.subscriptions")
            : t("profileEditor.title");
  const handleBack = () => {
    if (activeSection === "overview") {
      confirmOrRun(safeBack);
      return;
    }

    if (activeSection === "password") {
      confirmOrRun(() => setActiveSection("security"));
      return;
    }

    if (activeSection === "email" || activeSection === "phone") {
      setActiveSection("security");
      return;
    }

    if (activeSection === "personal") {
      confirmOrRun(() => setActiveSection("overview"));
      return;
    }

    setActiveSection("overview");
  };

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={handleBack}
          aria-label={t("actions.back", { ns: "common" })}
          className="settings-sticky-header-control flex h-9 items-center gap-1.5 rounded-md px-0 text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>{t("actions.back", { ns: "common" })}</span>
        </button>
        <div
          className={`settings-sticky-header-title pointer-events-none absolute left-1/2 flex h-9 -translate-x-1/2 items-center text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0 delay-0"
          }`}
          aria-hidden="true"
        >
          {title}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.25rem] font-semibold leading-none tracking-[-0.06em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {title}
      </h1>

      <SettingsContextCard context="profile" />

      {activeSection === "overview" ? (
        <div className="space-y-8">
          <section className="flex flex-col items-center text-center">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-28 w-28 rounded-full border border-white/[0.08] object-cover shadow-[0_18px_42px_rgba(0,0,0,0.28)]"
              />
            ) : (
              <div className="font-name flex h-28 w-28 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.08] text-[2rem] font-semibold tracking-[-0.06em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {initials}
              </div>
            )}
            <h2 className="font-name mt-5 text-[2.2rem] font-semibold leading-none tracking-[-0.075em] text-white">{fullName}</h2>
            <p className="mt-2 text-[1.05rem] font-medium tracking-[-0.04em] text-white/48">{user?.account.email}</p>
          </section>

          <SettingsGroup title={t("profileEditor.title")}>
            <SettingsRow
              label={t("profileEditor.menu.personalInformation")}
              onClick={() => setActiveSection("personal")}
              showChevron
            />
            <div className="mx-5 h-px bg-white/[0.06]" />
            <SettingsRow
              label={t("profileEditor.menu.signInSecurity")}
              onClick={() => setActiveSection("security")}
              showChevron
            />
            <div className="mx-5 h-px bg-white/[0.06]" />
            <SettingsRow
              label={t("profileEditor.menu.paymentShipping")}
              value={t("profileEditor.menu.notSet")}
              onClick={() => setActiveSection("payment")}
              showChevron
            />
            <div className="mx-5 h-px bg-white/[0.06]" />
            <SettingsRow
              label={t("profileEditor.menu.subscriptions")}
              onClick={() => setActiveSection("subscriptions")}
              showChevron
            />
          </SettingsGroup>
        </div>
      ) : activeSection === "security" ? (
        <div className="space-y-8">
          <SettingsGroup title={t("profileEditor.security.contact")}>
            <SettingsRow
              label={t("profileEditor.menu.email")}
              value={user?.account.email ?? ""}
              onClick={() => setActiveSection("email")}
              showChevron
            />
            <div className="mx-5 h-px bg-white/[0.06]" />
            <SettingsRow
              label={t("profileEditor.menu.phoneNumber")}
              value={profile?.phone || t("profileEditor.menu.notSet")}
              onClick={() => setActiveSection("phone")}
              showChevron
            />
          </SettingsGroup>

          <SettingsGroup title={t("profileEditor.security.title")}>
            <SettingsRow
              label={t("profileEditor.menu.changePassword")}
              onClick={() => setActiveSection("password")}
              showChevron
            />
          </SettingsGroup>
        </div>
      ) : activeSection === "password" ? (
        <form
          className="space-y-6"
          onSubmit={passwordForm.handleSubmit(async (values) => {
            setPasswordSuccessMessage(null);
            await passwordMutation.mutateAsync({
              currentPassword: values.currentPassword,
              newPassword: values.newPassword
            });
          })}
        >
          <ProfileFormSection title={t("profileEditor.menu.changePassword")}>
            <Input
              type="password"
              autoComplete="current-password"
              label={t("profileEditor.password.current")}
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register("currentPassword")}
            />
            <Input
              type="password"
              autoComplete="new-password"
              label={t("profileEditor.password.new")}
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register("newPassword")}
            />
            <Input
              type="password"
              autoComplete="new-password"
              label={t("profileEditor.password.confirm")}
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register("confirmPassword")}
            />
          </ProfileFormSection>
          <SettingsFormActions
            submitting={passwordMutation.isPending}
            successMessage={passwordSuccessMessage}
          />
          {!passwordSuccessMessage && passwordMutation.error ? (
            <p className="text-sm text-red-300">{getApiError(passwordMutation.error).message}</p>
          ) : null}
        </form>
      ) : activeSection === "personal" ? (
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
          <Input
            type="date"
            className="!mx-0 !max-w-none !rounded-2xl !text-left !text-base !font-normal"
            label={t("profileEditor.fields.dateOfBirth")}
            error={form.formState.errors.dateOfBirth?.message}
            {...form.register("dateOfBirth")}
          />
        </ProfileFormSection>

        <ProfileFormSection title={t("profileEditor.address")}>
          <Input label={t("profileEditor.fields.street")} error={form.formState.errors.street?.message} {...form.register("street")} />
          <Input label={t("profileEditor.fields.street2Optional")} error={form.formState.errors.apartment?.message} {...form.register("apartment")} />
          <Input label={t("profileEditor.fields.city")} error={form.formState.errors.city?.message} {...form.register("city")} />
          <Input label={t("profileEditor.fields.postalCode")} error={form.formState.errors.postalCode?.message} {...form.register("postalCode")} />
          <Input label={t("profileEditor.fields.region")} error={form.formState.errors.houseNumber?.message} {...form.register("houseNumber")} />
          <Input label={t("profileEditor.fields.countryCode")} error={form.formState.errors.countryCode?.message} {...form.register("countryCode")} />
        </ProfileFormSection>

        <SettingsFormActions submitting={mutation.isPending} successMessage={successMessage} />
        {!successMessage && mutation.error ? (
          <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
        ) : null}
        </form>
      ) : (
        <ProfilePlaceholder
          title={title}
          description={t(`profileEditor.menuDescriptions.${activeSection}`)}
        />
      )}
      {dialog}
    </div>
  );
}

function ProfilePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card as="section" className="px-5 py-6">
      <p className="text-[1.15rem] font-semibold tracking-[-0.05em] text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/48">{description}</p>
    </Card>
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
      <Card className="space-y-4 p-5">
        {children}
      </Card>
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
    addressId: profile?.addressId ?? "",
    employmentType: profile?.employmentType ?? "FULL_TIME",
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
    addressId: normalizeOptional(values.addressId),
    employmentType: values.employmentType,
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
