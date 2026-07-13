import { useMemo } from "react";
import { useLocation } from "react-router-dom";

const PAGE_CONTENT: Record<string, { title: string; body: string }> = {
  "/settings/profile": {
    title: "Profile",
    body: "Profile editing will live on this screen."
  },
  "/settings/security": {
    title: "Password & Security",
    body: "Password and sign-in controls will live on this screen."
  },
  "/settings/hourly-rates": {
    title: "Hourly Rates",
    body: "Hourly rate history and updates will live on this screen."
  },
  "/settings/work-types": {
    title: "Work Types",
    body: "Work type management and nested unit types will live on this screen."
  },
  "/settings/preferences/language": {
    title: "Language",
    body: "Language preferences will live on this screen."
  },
  "/settings/preferences/currency": {
    title: "Currency",
    body: "Currency preferences will live on this screen."
  },
  "/settings/preferences/timezone": {
    title: "Timezone",
    body: "Timezone preferences will live on this screen."
  },
  "/settings/preferences/appearance": {
    title: "Appearance",
    body: "Appearance preferences will live on this screen."
  },
  "/settings/preferences/date-format": {
    title: "Date Format",
    body: "Date formatting preferences will live on this screen."
  },
  "/settings/preferences/time-format": {
    title: "Time Format",
    body: "Time formatting preferences will live on this screen."
  },
  "/settings/preferences/first-day-of-week": {
    title: "First Day of Week",
    body: "Week start preferences will live on this screen."
  },
  "/settings/export-data": {
    title: "Export Data",
    body: "Data export controls will live on this screen."
  },
  "/settings/notifications": {
    title: "Notifications",
    body: "Notification preferences will live on this screen."
  },
  "/settings/about": {
    title: "About Roomly",
    body: "Product and version details will live on this screen."
  },
  "/settings/help": {
    title: "Help & Support",
    body: "Support resources will live on this screen."
  }
};

export function SettingsDetailPage() {
  const location = useLocation();
  const content = useMemo(
    () =>
      PAGE_CONTENT[location.pathname] ?? {
        title: "Settings",
        body: "This settings area is ready for its dedicated experience."
      },
    [location.pathname]
  );

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-[2rem] font-semibold tracking-[-0.07em] text-white">{content.title}</h1>
      <section className="rounded-[30px] border border-white/[0.05] bg-white/[0.035] px-6 py-6 backdrop-blur-sm">
        <p className="text-[1.05rem] leading-7 text-white/72">{content.body}</p>
      </section>
    </div>
  );
}
