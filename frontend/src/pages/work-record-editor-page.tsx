import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import {
  createAddress,
  createWorkRecord,
  deleteWorkRecord,
  getWorkRecord,
  getPreferences,
  listHourlyRates,
  listWorkTypes,
  updateWorkRecord
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Textarea } from "../components/ui/textarea";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { isValidDate, parseLocalIsoDate, safeLocalIsoDate } from "../utils/date";
import { parseDecimalInput } from "../utils/decimal-input";
import { formatCurrency, formatMinutesAsDuration } from "../utils/format";
import {
  calculateGrossAmount,
  calculateWorkRecordTimeMinutes,
  findApplicableHourlyRate
} from "../features/work-records/work-record-calculations";
import type { WorkType, WorkTypeFormulaMode } from "../types/configuration";
import type { Address, AddressPayload } from "../types/address";
import type { WorkRecord, WorkRecordRequest } from "../types/work-record";
import { APP_HOME_PATH } from "../routes/app-paths";

type OutletContext = {
  selectedDate?: Date;
  setSelectedDate?: (date: Date) => void;
};

type JobLineState = {
  id: string;
  workTypeId: string;
  calculationMode: WorkTypeFormulaMode | null;
  timeInputMode: "RANGE" | "DURATION";
  quantity: string;
  fixedAmount: string;
  currency: string;
  startTime: string;
  endTime: string;
  durationMinutes: string;
  unpaidBreakMinutes: string;
  extraPayPercentage: string;
  notes: string;
};

function newLine(): JobLineState {
  return {
    id: createClientLineId(),
    workTypeId: "",
    calculationMode: null,
    timeInputMode: "RANGE",
    quantity: "0",
    fixedAmount: "",
    currency: "EUR",
    startTime: "08:00",
    endTime: "16:30",
    durationMinutes: "",
    unpaidBreakMinutes: "30",
    extraPayPercentage: "0",
    notes: ""
  };
}

function createClientLineId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function invalidateWorkRecordQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.calendar.activityRange() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
  ]);
}

function recordToLines(record: WorkRecord): JobLineState[] {
  if (record.workLines?.length) {
    return record.workLines.map((line) => ({
      id: line.id,
      workTypeId: line.workTypeId,
      calculationMode: line.calculationMode,
      timeInputMode: line.durationMinutes ? "DURATION" : "RANGE",
      quantity: line.quantity ? String(Number(line.quantity)) : "0",
      fixedAmount: line.fixedAmountSnapshot ? String(Number(line.fixedAmountSnapshot)) : "",
      currency: line.currencySnapshot ?? "EUR",
      startTime: line.startTime?.slice(0, 5) ?? "08:00",
      endTime: line.endTime?.slice(0, 5) ?? "16:30",
      durationMinutes: line.durationMinutes ? formatDecimalHours(line.durationMinutes) : "",
      unpaidBreakMinutes: String(line.breakMinutes ?? 0),
      extraPayPercentage: String(line.extraPayPercentage ?? 0),
      notes: line.notes ?? "",
      quantities: {}
    }));
  }
  return [];
}

export function WorkRecordEditorPage() {
  const { t } = useTranslation(["records", "common"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { recordId } = useParams();
  const isEditing = Boolean(recordId);
  const outletContext = useOutletContext<OutletContext | null>();
  const selectedDate = useMemo(() => {
    const fromUrl = searchParams.get("date");
    if (fromUrl) {
      return parseLocalIsoDate(fromUrl);
    }
    return isValidDate(outletContext?.selectedDate) ? outletContext.selectedDate : new Date();
  }, [outletContext, searchParams]);

  const [workDate, setWorkDate] = useState(safeLocalIsoDate(selectedDate));
  const [dateMode, setDateMode] = useState<"SINGLE_DAY" | "DATE_RANGE">("SINGLE_DAY");
  const [workEndDate, setWorkEndDate] = useState(safeLocalIsoDate(selectedDate));
  const [addressId, setAddressId] = useState("");
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressPayload>({
    street: "",
    street2: "",
    postalCode: "",
    city: "",
    region: "",
    country: ""
  });
  const [teamSize, setTeamSize] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<JobLineState[]>([]);
  const [workTypePickerOpen, setWorkTypePickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const safeBack = useSafeBackNavigation({ fallback: APP_HOME_PATH });

  function returnToDashboard() {
    const returnDate = searchParams.get("returnDate") ?? searchParams.get("date");
    if (returnDate) {
      outletContext?.setSelectedDate?.(parseLocalIsoDate(returnDate));
    }
    navigate(APP_HOME_PATH, { replace: true });
  }

  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
  });
  const recordQuery = useQuery({
    queryKey: queryKeys.workRecords.detail(recordId ?? ""),
    queryFn: () => getWorkRecord(recordId!),
    enabled: Boolean(recordId)
  });

  const createMutation = useMutation({
    mutationFn: createWorkRecord,
    onSuccess: async () => {
      setSuccess(true);
      await invalidateWorkRecordQueries(queryClient);
      window.setTimeout(returnToDashboard, 520);
    }
  });
  const updateMutation = useMutation({
    mutationFn: (payload: WorkRecordRequest) => updateWorkRecord(recordId!, payload),
    onSuccess: async () => {
      setSuccess(true);
      await invalidateWorkRecordQueries(queryClient);
      window.setTimeout(returnToDashboard, 520);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkRecord(recordId!),
    onSuccess: async () => {
      await invalidateWorkRecordQueries(queryClient);
      returnToDashboard();
    }
  });
  const createAddressMutation = useMutation({
    mutationFn: createAddress
  });

  useEffect(() => {
    if (!recordQuery.data) {
      return;
    }
    setWorkDate(recordQuery.data.workDate);
    setDateMode(recordQuery.data.workEndDate ? "DATE_RANGE" : "SINGLE_DAY");
    setWorkEndDate(recordQuery.data.workEndDate ?? recordQuery.data.workDate);
    setAddressId(recordQuery.data.addressId ?? "");
    if (recordQuery.data.address) {
      setAddressDraft({
        street: recordQuery.data.address.street ?? "",
        street2: recordQuery.data.address.street2 ?? "",
        postalCode: recordQuery.data.address.postalCode ?? "",
        city: recordQuery.data.address.city ?? "",
        region: recordQuery.data.address.region ?? "",
        country: recordQuery.data.address.country ?? ""
      });
    }
    setTeamSize(recordQuery.data.teamSize ? String(recordQuery.data.teamSize) : "");
    setNotes(recordQuery.data.notes ?? "");
    setLines(recordToLines(recordQuery.data));
  }, [recordQuery.data]);

  const isDirty =
    !success &&
    (dateMode === "DATE_RANGE" ||
      addressId !== "" ||
      hasAddressValues(addressDraft) ||
      teamSize !== "" ||
      notes.trim() !== "" ||
      lines.length > 0 ||
      lines.some(
        (line) =>
          line.workTypeId ||
              line.quantity !== "0" ||
          line.durationMinutes !== "" ||
          line.notes.trim()
      ));
  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty: isDirty && !createMutation.isPending && !updateMutation.isPending && !deleteMutation.isPending
  });

  useEffect(() => {
    let frameId = 0;
    const updateCompactTitle = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const titleRect = largeTitleRef.current?.getBoundingClientRect();
        const buttonRect = backButtonRef.current?.getBoundingClientRect();
        setCompactTitleVisible(Boolean(titleRect && buttonRect && titleRect.top <= buttonRect.top));
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

  const isLoading =
    workTypesQuery.isLoading ||
    hourlyRatesQuery.isLoading ||
    preferencesQuery.isLoading ||
    recordQuery.isLoading;
  const loadingError =
    workTypesQuery.error ?? hourlyRatesQuery.error ?? preferencesQuery.error ?? recordQuery.error;

  const workTypes = useMemo(
    () => (workTypesQuery.data ?? []).filter((workType) => workType.active),
    [workTypesQuery.data]
  );
  const groupedLines = useMemo(() => {
    const groups: Array<{ key: string; parent: WorkType | null; lines: JobLineState[] }> = [];
    for (const line of lines) {
      const workType = workTypes.find((item) => item.id === line.workTypeId);
      const parent = workType?.parentId ? workTypes.find((item) => item.id === workType.parentId) ?? null : null;
      const key = parent?.id ?? line.id;
      const existing = groups.find((group) => group.key === key);
      if (existing) existing.lines.push(line);
      else groups.push({ key, parent, lines: [line] });
    }
    return groups;
  }, [lines, workTypes]);
  const hasTeamworkLine = useMemo(
    () => lines.some((line) => workTypes.find((workType) => workType.id === line.workTypeId)?.teamworkEnabled),
    [lines, workTypes]
  );

  function updateLine(lineId: string, patch: Partial<JobLineState>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) {
          return line;
        }
        return { ...line, ...patch };
      })
    );
  }

  function addWorkTypeLine(workType: WorkType) {
    addWorkTypeLines([workType]);
  }

  function addWorkTypeGroup(parent: WorkType) {
    const children = workTypes
      .filter((item) => item.active && item.parentId === parent.id)
      .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));
    addWorkTypeLines(children.length ? children : [parent], true);
  }

  function addWorkTypeLines(selectedWorkTypes: WorkType[], grouped = false) {
    const nextLines = selectedWorkTypes.map((workType) => {
    const line = newLine();
    line.workTypeId = workType.id;
    line.calculationMode = workTypeCalculationMode(workType);
    line.currency = workType.currency ?? preferencesQuery.data?.currency ?? "EUR";
    line.unpaidBreakMinutes = String(workType.defaultBreakMinutes ?? 0);
      if (grouped && line.calculationMode === "TIME_HOURLY") {
        line.startTime = "";
        line.endTime = "";
      }
      if (grouped && line.calculationMode === "FIXED_AMOUNT") {
        line.fixedAmount = "0";
      }
      return line;
    });
    setLines((current) => [...current, ...nextLines]);
    setWorkTypePickerOpen(false);
  }

  async function handleSubmit() {
    setFormError(null);
    let resolvedAddressId = addressId;
    if (hasAddressValues(addressDraft) && !matchesAddress(addressDraft, recordQuery.data?.address)) {
      try {
        const address = await createAddressMutation.mutateAsync(normalizeAddressPayload(addressDraft));
        resolvedAddressId = address.id;
        setAddressId(address.id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all() });
      } catch (error) {
        setFormError(getApiError(error).message);
        return;
      }
    } else if (!hasAddressValues(addressDraft)) {
      resolvedAddressId = "";
    }
    const validation = buildPayload({
      t,
      workDate,
      workEndDate: dateMode === "DATE_RANGE" ? workEndDate : null,
      addressId: resolvedAddressId,
      teamSize,
      notes,
      lines,
      workTypes
    });
    if ("error" in validation) {
      setFormError(validation.error);
      return;
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync(validation.payload);
      } else {
        await createMutation.mutateAsync(validation.payload);
      }
    } catch {
      // The mutation error is rendered below and input state is preserved.
    }
  }

  if (isLoading) {
    return (
      <ScreenMessage
        title={t("records:job.loading")}
        description={t("records:editor.loadingDescription")}
      />
    );
  }

  if (loadingError) {
    return (
      <ScreenMessage
        title={t("records:editor.unavailableTitle")}
        description={getApiError(loadingError).message}
      />
    );
  }

  if (!workTypes.length) {
    return (
      <ScreenMessage
        title={t("records:editor.noWorkTypesTitle")}
        description={t("records:editor.noWorkTypesDescription")}
      />
    );
  }

  const saveMutation = isEditing ? updateMutation : createMutation;
  const saveError = saveMutation.error ? getApiError(saveMutation.error).message : null;
  const pageTitle = isEditing ? t("records:job.editTitle") : t("records:job.title");

  return (
    <div className="mx-auto min-w-0 w-full max-w-[560px] space-y-8 overflow-x-clip pb-6 pt-12">
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
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 top-[3.75rem] flex h-10 -translate-x-1/2 items-center text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0"
          }`}
        >
          {pageTitle}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.8rem] font-semibold leading-none tracking-[-0.08em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {pageTitle}
      </h1>

      <section className="space-y-3">
        <p className="hairline-text">{t("records:job.dates")}</p>
        <div className="dashboard-glass-card space-y-4 p-5">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
            <button
              type="button"
              className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${dateMode === "SINGLE_DAY" ? "bg-white text-black" : "text-white/58 hover:text-white"}`}
              onClick={() => setDateMode("SINGLE_DAY")}
            >
              {t("records:job.oneDay")}
            </button>
            <button
              type="button"
              className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${dateMode === "DATE_RANGE" ? "bg-white text-black" : "text-white/58 hover:text-white"}`}
              onClick={() => {
                setDateMode("DATE_RANGE");
                if (workEndDate < workDate) setWorkEndDate(workDate);
              }}
            >
              {t("records:job.dateRange")}
            </button>
          </div>
          <div className={`grid items-end gap-3 ${dateMode === "DATE_RANGE" ? "grid-cols-2" : "grid-cols-1"}`}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/78">
                {dateMode === "DATE_RANGE" ? t("records:fields.workStartDate") : t("records:fields.workDate")}
              </span>
              <input
                type="date"
                aria-label={t("records:fields.workDate")}
                value={workDate}
                onChange={(event) => {
                  const nextDate = event.currentTarget.value;
                  setWorkDate(nextDate);
                  if (dateMode === "DATE_RANGE" && workEndDate < nextDate) setWorkEndDate(nextDate);
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 text-center text-sm font-medium text-white outline-none transition focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
              />
            </label>
            {dateMode === "DATE_RANGE" ? (
              <label className="block min-w-0 space-y-2">
                <span className="text-sm font-medium text-white/78">{t("records:fields.workEndDate")}</span>
                <input
                  type="date"
                  min={workDate}
                  aria-label={t("records:fields.workEndDate")}
                  value={workEndDate}
                  onChange={(event) => setWorkEndDate(event.currentTarget.value)}
                  className="h-12 w-full min-w-0 appearance-none rounded-2xl border border-white/[0.12] bg-white/[0.06] px-2 text-center text-sm font-medium text-white outline-none transition focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
                />
              </label>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          aria-expanded={addressExpanded}
          onClick={() => setAddressExpanded((value) => !value)}
          className="flex w-full items-center justify-between gap-4 rounded-lg py-1 text-left focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <span className="hairline-text">{t("records:job.address")}</span>
          <ChevronRight
            className={`hairline-text h-4 w-4 shrink-0 transition-transform duration-200 ${addressExpanded ? "rotate-90" : "rotate-0"}`}
            aria-hidden="true"
          />
        </button>
        {addressExpanded ? (
          <AddressFields
            draft={addressDraft}
            onDraftChange={setAddressDraft}
          />
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="hairline-text">{t("records:job.lines")}</p>
        </div>
        {lines.length === 0 ? (
          <button
            type="button"
            onClick={() => setWorkTypePickerOpen(true)}
            className="dashboard-glass-card flex min-h-36 w-full items-center justify-center transition hover:bg-white/[0.065] focus:outline-none focus:ring-2 focus:ring-white/24"
            aria-label={t("records:job.addActivity")}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.07] text-white">
              <Plus className="h-6 w-6" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            {groupedLines.map((group) =>
              group.parent ? (
                <section key={group.key} className="dashboard-glass-card overflow-hidden px-4 py-3">
                  <div className="flex items-center gap-3 pb-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: group.parent.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-white">{group.parent.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const childIds = new Set(group.lines.map((line) => line.id));
                        setLines((current) => current.filter((line) => !childIds.has(line.id)));
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/42 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
                      aria-label={t("records:job.removeLine")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.07]">
                    {group.lines.map((line) => (
                      <WorkRecordLineCard
                        key={line.id}
                        embedded
                        index={lines.indexOf(line)}
                        line={line}
                        workTypes={workTypes}
                        workDate={workDate}
                        hourlyRates={hourlyRatesQuery.data ?? []}
                        teamSize={teamSize}
                        onChange={updateLine}
                        onRemove={null}
                      />
                    ))}
                  </div>
                  <WorkTypeGroupSummary
                    lines={group.lines}
                    workTypes={workTypes}
                    hourlyRates={hourlyRatesQuery.data ?? []}
                    workDate={workDate}
                    teamSize={teamSize}
                  />
                </section>
              ) : (
                <WorkRecordLineCard
                  key={group.key}
                  index={lines.indexOf(group.lines[0])}
                  line={group.lines[0]}
                  workTypes={workTypes}
                  workDate={workDate}
                  hourlyRates={hourlyRatesQuery.data ?? []}
                  teamSize={teamSize}
                  onChange={updateLine}
                  onRemove={() => setLines((current) => current.filter((item) => item.id !== group.lines[0].id))}
                />
              )
            )}
            {hasTeamworkLine ? (
              <div className="flex items-center justify-between gap-4 rounded-[20px] border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                <label htmlFor="job-team-size" className="text-sm font-semibold text-white">
                  {t("records:job.teamSize")}
                </label>
                <input
                  id="job-team-size"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={teamSize}
                  onFocus={() => {
                    if (teamSize === "0") setTeamSize("");
                  }}
                  onChange={(event) => setTeamSize(event.currentTarget.value)}
                  className="h-10 w-20 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 text-center text-base font-semibold text-white outline-none transition focus:border-white/[0.28] focus:ring-2 focus:ring-white/24"
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setWorkTypePickerOpen(true)}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/52 transition hover:bg-white/[0.035] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("records:job.addAnotherActivity")}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="hairline-text">{t("records:fields.notes")}</p>
        <Textarea
          label={t("records:fields.notes")}
          labelClassName="sr-only"
          rows={3}
          className="min-h-24 resize-none bg-white/[0.04]"
          placeholder={t("records:job.notesPlaceholder")}
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
      </section>

      {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
      {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}

      <div className="space-y-3 pt-1">
        <Button className="w-full" type="button" disabled={saveMutation.isPending || createAddressMutation.isPending || success} onClick={() => void handleSubmit()}>
          {saveMutation.isPending || createAddressMutation.isPending
            ? t("records:job.saving")
            : success
              ? t("records:saved")
              : isEditing
                ? t("records:job.saveChanges")
                : t("records:job.save")}
        </Button>
        {isEditing ? (
          <Button
            className="w-full border-red-300/20 bg-red-500/12 text-red-100 hover:bg-red-500/18"
            type="button"
            variant="secondary"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(t("records:job.deleteConfirm"))) {
                deleteMutation.mutate();
              }
            }}
          >
            {deleteMutation.isPending ? t("records:job.deleting") : t("records:job.delete")}
          </Button>
        ) : null}
      </div>
      {deleteMutation.error ? <p className="text-sm text-red-300">{getApiError(deleteMutation.error).message}</p> : null}

      {success ? (
        <div className="glass-panel fixed inset-x-6 top-24 z-[70] mx-auto max-w-sm rounded-[28px] px-5 py-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
            <Check className="h-6 w-6" />
          </div>
          <p className="mt-3 text-base font-semibold text-white">{t("records:job.savedToast")}</p>
        </div>
      ) : null}
      {workTypePickerOpen ? (
        <WorkTypePickerDialog
          workTypes={workTypes}
          onSelect={addWorkTypeLine}
          onSelectGroup={addWorkTypeGroup}
          onClose={() => setWorkTypePickerOpen(false)}
        />
      ) : null}
      {dialog}
    </div>
  );
}

function AddressFields({
  draft,
  onDraftChange
}: {
  draft: AddressPayload;
  onDraftChange: (value: AddressPayload) => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <div className="dashboard-glass-card p-5">
        <div className="space-y-3">
          <Input
            label={t("profileEditor.fields.street")}
            value={draft.street}
            onChange={(event) => onDraftChange({ ...draft, street: event.currentTarget.value })}
          />
          <Input
            label={t("profileEditor.fields.street2Optional")}
            value={draft.street2 ?? ""}
            onChange={(event) => onDraftChange({ ...draft, street2: event.currentTarget.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("profileEditor.fields.city")}
              value={draft.city}
              onChange={(event) => onDraftChange({ ...draft, city: event.currentTarget.value })}
            />
            <Input
              label={t("profileEditor.fields.postalCode")}
              value={draft.postalCode ?? ""}
              onChange={(event) => onDraftChange({ ...draft, postalCode: event.currentTarget.value })}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr),6rem] gap-3">
            <Input
              label={t("profileEditor.fields.region")}
              value={draft.region ?? ""}
              onChange={(event) => onDraftChange({ ...draft, region: event.currentTarget.value })}
            />
            <Input
              label={t("profileEditor.fields.countryCode")}
              value={draft.country}
              maxLength={2}
              onChange={(event) => onDraftChange({ ...draft, country: event.currentTarget.value.toUpperCase() })}
            />
          </div>
        </div>
    </div>
  );
}

function WorkTypePickerDialog({
  workTypes,
  onSelect,
  onSelectGroup,
  onClose
}: {
  workTypes: WorkType[];
  onSelect: (workType: WorkType) => void;
  onSelectGroup: (workType: WorkType) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("records");
  const parents = workTypes
    .filter((item) => item.active && !item.parentId)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));
  const childrenByParent = workTypes.reduce<Record<string, WorkType[]>>((groups, item) => {
    if (item.active && item.parentId) {
      groups[item.parentId] = [...(groups[item.parentId] ?? []), item]
        .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));
    }
    return groups;
  }, {});

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/58 px-4 py-[max(1rem,env(safe-area-inset-top),env(safe-area-inset-bottom))] backdrop-blur-sm">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label={t("job.closePicker")} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-type-picker-title"
        className="dashboard-glass-card relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden bg-[#111]/95"
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <h2 id="work-type-picker-title" className="text-xl font-semibold tracking-[-0.05em] text-white">
            {t("job.chooseActivity")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/52 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
            aria-label={t("job.closePicker")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {parents.map((parent) => {
            const children = childrenByParent[parent.id] ?? [];
            return (
              <div key={parent.id} className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => children.length ? onSelectGroup(parent) : onSelect(parent)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: parent.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-white">{parent.name}</span>
                    {children.length ? (
                      <span className="mt-1 block text-xs text-white/42">{t("job.activityCount", { count: children.length })}</span>
                    ) : null}
                  </span>
                  {children.length ? (
                    <ChevronRight className="h-5 w-5 shrink-0 text-white/36" aria-hidden="true" />
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WorkRecordLineCard({
  embedded = false,
  index,
  line,
  workTypes,
  workDate,
  hourlyRates,
  teamSize,
  onChange,
  onRemove
}: {
  embedded?: boolean;
  index: number;
  line: JobLineState;
  workTypes: WorkType[];
  workDate: string;
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>;
  teamSize: string;
  onChange: (lineId: string, patch: Partial<JobLineState>) => void;
  onRemove: (() => void) | null;
}) {
  const { t } = useTranslation(["records", "common"]);
  const selectedWorkType = workTypes.find((workType) => workType.id === line.workTypeId) ?? null;
  const preview = buildLinePreview(line, selectedWorkType, hourlyRates, workDate, teamSize);

  useEffect(() => {
    if (!selectedWorkType) {
      return;
    }
    const mode = workTypeCalculationMode(selectedWorkType);
    if (line.calculationMode === mode) {
      return;
    }
    onChange(line.id, { calculationMode: mode });
  }, [line.calculationMode, line.id, onChange, selectedWorkType]);

  return (
    <div className={embedded
      ? "relative space-y-2 py-3 first:pt-2 last:pb-0"
      : "relative space-y-3 rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-4"}
    >
      <div className="flex items-center justify-between gap-4">
        <p className={`min-w-0 truncate font-semibold tracking-[-0.03em] text-white ${embedded ? "text-sm" : "text-base"}`}>
          {selectedWorkType ? selectedWorkType.name : t("records:job.lineTitle", { count: index + 1 })}
        </p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-white/[0.08] bg-white/[0.06] p-2 text-white/62 transition hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
            aria-label={t("records:job.removeLine")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {selectedWorkType && line.calculationMode === "TIME_HOURLY" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] p-1">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${line.timeInputMode === "RANGE" ? "bg-white text-black" : "text-white/62 hover:text-white"}`}
              onClick={() => onChange(line.id, { timeInputMode: "RANGE" })}
            >
              {t("records:fields.timeRange")}
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${line.timeInputMode === "DURATION" ? "bg-white text-black" : "text-white/62 hover:text-white"}`}
              onClick={() => onChange(line.id, { timeInputMode: "DURATION" })}
            >
              {t("records:fields.duration")}
            </button>
          </div>
          {line.timeInputMode === "RANGE" ? (
            <div className="grid min-w-0 grid-cols-2 gap-3 overflow-hidden">
              <Input
                label={t("records:fields.startTime")}
                type="time"
                wrapperClassName="min-w-0 overflow-hidden"
                className="!w-full !min-w-0 !max-w-full appearance-none overflow-hidden px-1 text-center text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-center"
                value={line.startTime}
                onChange={(event) => onChange(line.id, { startTime: event.currentTarget.value })}
              />
              <Input
                label={t("records:fields.endTime")}
                type="time"
                wrapperClassName="min-w-0 overflow-hidden"
                className="!w-full !min-w-0 !max-w-full appearance-none overflow-hidden px-1 text-center text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-center"
                value={line.endTime}
                onChange={(event) => onChange(line.id, { endTime: event.currentTarget.value })}
              />
            </div>
          ) : (
            <div className={embedded ? "grid grid-cols-1 items-end gap-2" : "grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2"}>
              <Input
                label={t("records:fields.durationHours")}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[,.]?[0-9]*"
                min={0}
                value={line.durationMinutes}
                onFocus={() => {
                  if (line.durationMinutes === "0") onChange(line.id, { durationMinutes: "" });
                }}
                onChange={(event) => onChange(line.id, { durationMinutes: event.currentTarget.value })}
              />
              {!embedded ? (
                <Input
                  label={t("records:fields.extraPay")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1000}
                  wrapperClassName="min-w-0"
                  className="min-w-0 px-2 text-center"
                  value={line.extraPayPercentage}
                  onFocus={() => {
                    if (line.extraPayPercentage === "0") onChange(line.id, { extraPayPercentage: "" });
                  }}
                  onChange={(event) => onChange(line.id, { extraPayPercentage: event.currentTarget.value })}
                />
              ) : null}
            </div>
          )}
          {line.timeInputMode === "RANGE" ? (
            <div className={embedded ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-3"}>
              <Input
                label={t("records:fields.breakMinutes")}
                type="number"
                inputMode="numeric"
                min={0}
                wrapperClassName="min-w-0"
                className="min-w-0 px-2 text-center text-base"
                value={line.unpaidBreakMinutes}
                onFocus={() => onChange(line.id, { unpaidBreakMinutes: "" })}
                onChange={(event) => onChange(line.id, { unpaidBreakMinutes: event.currentTarget.value })}
              />
              {!embedded ? <Input
                label={t("records:fields.extraPay")}
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                wrapperClassName="min-w-0"
                className="min-w-0 px-2 text-center text-base"
                value={line.extraPayPercentage}
                onFocus={() => {
                  if (line.extraPayPercentage === "0") onChange(line.id, { extraPayPercentage: "" });
                }}
                onChange={(event) => onChange(line.id, { extraPayPercentage: event.currentTarget.value })}
              /> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedWorkType && line.calculationMode === "FIXED_AMOUNT" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="500"
              label={t("records:fields.fixedAmount")}
                value={line.fixedAmount}
                onFocus={() => {
                  if (line.fixedAmount === "0") onChange(line.id, { fixedAmount: "" });
                }}
              onChange={(event) => onChange(line.id, { fixedAmount: event.currentTarget.value })}
            />
            <Input
              label={t("records:fields.currency")}
              maxLength={3}
              value={line.currency}
              onChange={(event) => onChange(line.id, { currency: event.currentTarget.value.toUpperCase() })}
            />
          </div>
        </div>
      ) : null}

      {selectedWorkType && line.calculationMode !== "TIME_HOURLY" && line.calculationMode !== "FIXED_AMOUNT" ? (
        <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr),auto] items-center gap-2">
              <div className="min-w-0">
                <p className="text-xs text-white/44">{workTypeRateLabel(selectedWorkType)}</p>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-2">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[,.]?[0-9]*"
                value={line.quantity}
                onFocus={() => {
                  if (line.quantity === "0") onChange(line.id, { quantity: "" });
                }}
                onChange={(event) => onChange(line.id, { quantity: event.currentTarget.value })}
                className={`${embedded ? "h-10 w-[6.5rem]" : "h-11 w-32"} min-w-0 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 text-right text-base font-semibold text-white outline-none transition focus:border-white/[0.28] focus:ring-2 focus:ring-white/24`}
                aria-label={`${selectedWorkType.unitLabel ?? selectedWorkType.name} ${t("records:unitRows.quantity")}`}
              />
                <span className="max-w-24 truncate text-xs font-semibold text-white/48">
                  {selectedWorkType.unitSymbol ?? selectedWorkType.unitLabel}
                </span>
              </div>
            </div>
          {line.calculationMode === "UNITS_PER_HOUR" && !embedded ? (
            <div className="grid grid-cols-1 gap-3">
              <Input
                label={t("records:fields.extraPay")}
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                value={line.extraPayPercentage}
                onFocus={() => {
                  if (line.extraPayPercentage === "0") onChange(line.id, { extraPayPercentage: "" });
                }}
                onChange={(event) => onChange(line.id, { extraPayPercentage: event.currentTarget.value })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {preview && !embedded ? (
        <div className="border-t border-white/[0.07] pt-3 text-sm text-white/62">
          <div className="flex items-center justify-between gap-4">
            <span>{preview.label}</span>
            {preview.amount ? <span className="font-semibold text-white">{preview.amount}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkTypeGroupSummary({
  lines,
  workTypes,
  hourlyRates,
  workDate,
  teamSize
}: {
  lines: JobLineState[];
  workTypes: WorkType[];
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>;
  workDate: string;
  teamSize: string;
}) {
  const summary = buildGroupSummary(lines, workTypes, hourlyRates, workDate, teamSize);
  if (!summary) return null;

  return (
    <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-3 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-white/58">
        {summary.actualMinutes > 0 ? <span>{formatMinutesAsDuration(summary.actualMinutes)}</span> : null}
        {summary.equivalentMinutes > 0 ? <span>≈ {formatMinutesAsDuration(summary.equivalentMinutes)}</span> : null}
      </div>
      {summary.amounts.length ? (
        <div className="shrink-0 text-right font-semibold text-white">
          {summary.amounts.map((amount) => (
            <div key={amount.currency}>{formatCurrency(String(amount.value), amount.currency)}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildGroupSummary(
  lines: JobLineState[],
  workTypes: WorkType[],
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>,
  workDate: string,
  teamSize: string
) {
  let actualMinutes = 0;
  let equivalentMinutes = 0;
  const amounts = new Map<string, number>();
  const hourlyRate = findApplicableHourlyRate(hourlyRates, workDate);

  const addAmount = (value: number, currency?: string | null) => {
    if (!Number.isFinite(value) || value <= 0 || !currency) return;
    amounts.set(currency, (amounts.get(currency) ?? 0) + value);
  };

  for (const line of lines) {
    const workType = workTypes.find((item) => item.id === line.workTypeId);
    if (!workType || !hasMeaningfulLineInput(line)) continue;
    const mode = workTypeCalculationMode(workType);

    if (mode === "TIME_HOURLY") {
      const minutes = line.timeInputMode === "DURATION"
        ? Math.round(parseDecimalInput(line.durationMinutes) * 60)
        : calculateWorkRecordTimeMinutes({
            startTime: line.startTime,
            endTime: line.endTime,
            breakMinutes: Number(line.unpaidBreakMinutes || 0)
          })?.workedMinutes ?? 0;
      actualMinutes += minutes;
      if (hourlyRate) addAmount(calculateGrossAmount(minutes, hourlyRate.hourlyRate), hourlyRate.currency);
      continue;
    }

    if (mode === "UNITS_PER_HOUR") {
      const quantity = parseDecimalInput(line.quantity);
      const unitsPerHour = Number(workType.unitsPerHour);
      const minutes = unitsPerHour > 0 ? Math.round((quantity / unitsPerHour) * 60) : 0;
      equivalentMinutes += minutes;
      if (hourlyRate) addAmount(calculateGrossAmount(minutes, hourlyRate.hourlyRate), hourlyRate.currency);
      continue;
    }

    if (mode === "UNITS_PER_UNIT") {
      const quantity = parseDecimalInput(line.quantity);
      const rate = Number(workType.ratePerUnit);
      const workers = workType.teamworkEnabled ? Number(teamSize) : 1;
      if (Number.isFinite(rate) && workers > 0) addAmount((quantity * rate) / workers, workType.currency);
      const unitsPerHour = Number(workType.unitsPerHour);
      if (unitsPerHour > 0) equivalentMinutes += Math.round((quantity / unitsPerHour) * 60);
      continue;
    }

    if (mode === "FIXED_AMOUNT") {
      addAmount(parseDecimalInput(line.fixedAmount), line.currency);
    }
  }

  if (!actualMinutes && !equivalentMinutes && !amounts.size) return null;
  return {
    actualMinutes,
    equivalentMinutes,
    amounts: Array.from(amounts, ([currency, value]) => ({ currency, value }))
  };
}

function buildLinePreview(
  line: JobLineState,
  workType: WorkType | null,
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>,
  workDate: string,
  teamSize: string
) {
  if (!workType) {
    return null;
  }
  const mode = workTypeCalculationMode(workType);
  if (mode === "FIXED_AMOUNT") {
    const fixedAmount = parseDecimalInput(line.fixedAmount);
    const currency = line.currency.trim().toUpperCase();
    if (!Number.isFinite(fixedAmount) || fixedAmount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return null;
    }
    return {
      label: workType.name,
      amount: formatCurrency(String(fixedAmount), currency)
    };
  }
  if (mode === "TIME_HOURLY") {
    if (line.timeInputMode === "DURATION") {
      const durationHours = parseDecimalInput(line.durationMinutes);
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        return null;
      }
      const durationMinutes = Math.round(durationHours * 60);
      const rate = findApplicableHourlyRate(hourlyRates, workDate);
      const gross = rate ? calculateGrossAmount(durationMinutes, rate.hourlyRate) : 0;
      return {
        label: formatMinutesAsDuration(durationMinutes),
        amount: rate ? formatCurrency(String(gross), rate.currency) : null
      };
    }
    const calculation = calculateWorkRecordTimeMinutes({
      startTime: line.startTime,
      endTime: line.endTime,
      breakMinutes: Number(line.unpaidBreakMinutes || 0)
    });
    if (!calculation) {
      return null;
    }
    const rate = findApplicableHourlyRate(hourlyRates, workDate);
    const gross = rate ? calculateGrossAmount(calculation.workedMinutes, rate.hourlyRate) : 0;
    return {
      label: formatMinutesAsDuration(calculation.workedMinutes),
      amount: rate ? formatCurrency(String(gross), rate.currency) : null
    };
  }
  const quantity = parseDecimalInput(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  const unit = workType.unitSymbol ?? workType.unitLabel ?? workType.name;
  if (mode === "UNITS_PER_UNIT") {
    const rate = Number(workType.ratePerUnit ?? NaN);
    const workers = workType.teamworkEnabled ? Number(teamSize) : 1;
    const amount = Number.isFinite(rate) && workers > 0 ? (quantity * rate) / workers : null;
    return {
      label: `${quantity} ${unit}`,
      amount: amount !== null && workType.currency ? formatCurrency(String(amount), workType.currency) : null
    };
  }
  return {
    label: `${quantity} ${unit}`,
    amount: null
  };
}

function workTypeRateLabel(workType: WorkType) {
  const mode = workTypeCalculationMode(workType);
  if (mode === "UNITS_PER_UNIT") {
    return `${workType.ratePerUnit ?? ""} ${workType.currency ?? ""}/${workType.unitSymbol ?? workType.unitLabel ?? workType.name}`;
  }
  if (mode === "UNITS_PER_HOUR") {
    const unit = workType.unitSymbol ?? workType.unitLabel ?? workType.name;
    return `${workType.unitsPerHour ?? ""} ${unit}/h`;
  }
  return "";
}

function workTypeCalculationMode(workType: WorkType | null): WorkTypeFormulaMode | null {
  if (!workType) return null;
  if (workType.calculationMethod === "TIME_BASED") return "TIME_HOURLY";
  if (workType.calculationMethod === "UNITS_PER_HOUR_BASED") return "UNITS_PER_HOUR";
  if (workType.calculationMethod === "FIXED_PRICE_BASED") return "FIXED_AMOUNT";
  return "UNITS_PER_UNIT";
}

function buildPayload({
  t,
  workDate,
  workEndDate,
  addressId,
  teamSize,
  notes,
  lines,
  workTypes
}: {
  t: ReturnType<typeof useTranslation<["records", "common"]>>["t"];
  workDate: string;
  workEndDate: string | null;
  addressId: string;
  teamSize: string;
  notes: string;
  lines: JobLineState[];
  workTypes: WorkType[];
}): { payload: WorkRecordRequest } | { error: string } {
  if (!workDate) {
    return { error: t("records:validation.dateRequired") };
  }
  if (workEndDate && workEndDate < workDate) {
    return { error: t("records:validation.endDateBeforeStart") };
  }
  if (!lines.length) {
    return { error: t("records:validation.addActivity") };
  }

  const hasTeamworkLine = lines.some(
    (line) => workTypes.find((workType) => workType.id === line.workTypeId)?.teamworkEnabled
  );
  const normalizedTeamSize = Number(teamSize);
  if (hasTeamworkLine && (!Number.isInteger(normalizedTeamSize) || normalizedTeamSize <= 0)) {
    return { error: t("records:validation.teamSizeRequired") };
  }

  const payloadLines = [];
  for (const line of lines) {
    const workType = workTypes.find((item) => item.id === line.workTypeId);
    if (!workType) {
      return { error: t("records:validation.chooseWorkType") };
    }
    if (workType.parentId && !hasMeaningfulLineInput(line)) {
      continue;
    }
    const baseLine = {
      workTypeId: line.workTypeId,
      notes: emptyToNull(line.notes)
    };
    if (line.calculationMode === "TIME_HOURLY") {
      if (line.timeInputMode === "DURATION") {
        const durationHours = parseDecimalInput(line.durationMinutes);
        if (!Number.isFinite(durationHours) || durationHours <= 0) {
          return { error: t("records:validation.positiveDuration") };
        }
        const durationMinutes = Math.round(durationHours * 60);
        payloadLines.push({
          ...baseLine,
          durationMinutes,
          extraPayPercentage: workType.parentId ? 0 : Number(line.extraPayPercentage || 0)
        });
        continue;
      }
      if (!line.startTime || !line.endTime) {
        return { error: t("records:validation.timeRequired") };
      }
      payloadLines.push({
        ...baseLine,
        startTime: line.startTime,
        endTime: line.endTime,
        unpaidBreakMinutes: Number(line.unpaidBreakMinutes || 0),
        extraPayPercentage: workType.parentId ? 0 : Number(line.extraPayPercentage || 0)
      });
      continue;
    }
    if (line.calculationMode === "FIXED_AMOUNT") {
      const fixedAmount = parseDecimalInput(line.fixedAmount);
      const currency = line.currency.trim().toUpperCase();
      if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) {
        return { error: t("records:validation.positiveFixedAmount") };
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        return { error: t("records:validation.currency") };
      }
      payloadLines.push({
        ...baseLine,
        fixedAmount,
        currency
      });
      continue;
    }
    const quantity = parseDecimalInput(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: t("records:validation.positiveUnitQuantity") };
    }
    payloadLines.push({
      ...baseLine,
      quantity,
      extraPayPercentage: line.calculationMode === "UNITS_PER_HOUR" && !workType.parentId ? Number(line.extraPayPercentage || 0) : 0
    });
  }

  if (!payloadLines.length) {
    return { error: t("records:validation.addActivity") };
  }

  return {
    payload: {
      workDate,
      workEndDate,
      addressId: emptyToNull(addressId),
      teamSize: hasTeamworkLine ? normalizedTeamSize : null,
      notes: emptyToNull(notes),
      lines: payloadLines
    }
  };
}

function hasMeaningfulLineInput(line: JobLineState) {
  if (line.calculationMode === "TIME_HOURLY") {
    return line.timeInputMode === "DURATION"
      ? parseDecimalInput(line.durationMinutes) > 0
      : Boolean(line.startTime && line.endTime);
  }
  if (line.calculationMode === "FIXED_AMOUNT") {
    return parseDecimalInput(line.fixedAmount) > 0;
  }
  return parseDecimalInput(line.quantity) > 0;
}

function emptyToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatDecimalHours(minutes: number) {
  return String(Number((minutes / 60).toFixed(2)));
}

function hasAddressValues(address: AddressPayload) {
  return [address.street, address.street2, address.postalCode, address.city, address.region, address.country]
    .some((value) => Boolean(value?.trim()));
}

function normalizeAddressPayload(address: AddressPayload): AddressPayload {
  return {
    street: address.street.trim(),
    street2: emptyToNull(address.street2),
    postalCode: emptyToNull(address.postalCode),
    city: address.city.trim(),
    region: emptyToNull(address.region),
    country: address.country.trim().toUpperCase()
  };
}

function matchesAddress(draft: AddressPayload, address?: Address | null) {
  if (!address) return false;
  const normalized = normalizeAddressPayload(draft);
  return normalized.street === address.street &&
    normalized.street2 === (address.street2 ?? null) &&
    normalized.postalCode === (address.postalCode ?? null) &&
    normalized.city === address.city &&
    normalized.region === (address.region ?? null) &&
    normalized.country === address.country;
}
