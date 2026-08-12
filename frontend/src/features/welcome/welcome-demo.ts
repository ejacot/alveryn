import {
  calculateFixedGrossAmount,
  calculateGrossAmount,
  calculatePerUnitGrossAmount,
  calculateWorkRecordTimeMinutes
} from "../work-records/work-record-calculations";

export type WelcomeDemoMode = "hourly" | "unit" | "fixed";

export type WelcomeDemoState = {
  mode: WelcomeDemoMode;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hourlyRate: number;
  unitName: string;
  quantity: number;
  unitRate: number;
  fixedName: string;
  fixedAmount: number;
};

export type WelcomeDemoResult = {
  workedMinutes: number;
  earnings: number;
  activityName: string;
  activityDetail: string;
  monthEarnings: number;
  monthMinutes: number;
};

export const INITIAL_WELCOME_DEMO_STATE: WelcomeDemoState = {
  mode: "hourly",
  startTime: "08:00",
  endTime: "16:30",
  breakMinutes: 30,
  hourlyRate: 17.5,
  unitName: "rooms",
  quantity: 24,
  unitRate: 4.8,
  fixedName: "Deep clean",
  fixedAmount: 145
};

const BASE_MONTH_MINUTES = 7_320;
const BASE_MONTH_EARNINGS = 2_486.4;

export function calculateWelcomeDemo(state: WelcomeDemoState): WelcomeDemoResult {
  if (state.mode === "hourly") {
    const time = calculateWorkRecordTimeMinutes({
      startTime: state.startTime,
      endTime: state.endTime,
      breakMinutes: state.breakMinutes
    });
    const workedMinutes = time?.workedMinutes ?? 0;
    const earnings = calculateGrossAmount(workedMinutes, state.hourlyRate);
    return {
      workedMinutes,
      earnings,
      activityName: "Hourly shift",
      activityDetail: `${state.startTime}–${state.endTime}`,
      monthMinutes: BASE_MONTH_MINUTES + workedMinutes,
      monthEarnings: BASE_MONTH_EARNINGS + earnings
    };
  }

  if (state.mode === "unit") {
    const earnings = calculatePerUnitGrossAmount(state.quantity, state.unitRate);
    return {
      workedMinutes: 0,
      earnings,
      activityName: state.unitName.trim() || "Units",
      activityDetail: `${state.quantity} × ${state.unitRate}`,
      monthMinutes: BASE_MONTH_MINUTES,
      monthEarnings: BASE_MONTH_EARNINGS + earnings
    };
  }

  const earnings = calculateFixedGrossAmount(state.fixedAmount);
  return {
    workedMinutes: 0,
    earnings,
    activityName: state.fixedName.trim() || "Fixed-price work",
    activityDetail: "Agreed amount",
    monthMinutes: BASE_MONTH_MINUTES,
    monthEarnings: BASE_MONTH_EARNINGS + earnings
  };
}
