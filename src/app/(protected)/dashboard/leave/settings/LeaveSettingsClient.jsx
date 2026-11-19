"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { FOCUS, LINE, NAVY } from "../../../../../components/hr/hrUi";
import GeneralTab from "./ui/GeneralTab";
import TypesTab from "./ui/TypesTab";
import ApproversTab from "./ui/ApproversTab";
import QuotaTab from "./ui/QuotaTab";
import HolidaysTab from "./ui/HolidaysTab";

const TABS = [
  { key: "general", label: "ทั่วไป" },
  { key: "types", label: "ประเภทการลา" },
  { key: "approvers", label: "ผู้อนุมัติ" },
  { key: "quota", label: "โควตาวันลา" },
  { key: "holidays", label: "วันหยุด" },
];

/** ตั้งค่าการลา — five tabs; ?tab= keeps the open tab across reloads. */
export default function LeaveSettingsClient(props) {
  const [tab, setTab] = useState(() => (TABS.some((t) => t.key === props.initialTab) ? props.initialTab : "general"));
  const [settings, setSettings] = useState(props.settings);
  const [types, setTypes] = useState(props.types);
  const [employees, setEmployees] = useState(props.employees);
  // Shared by ผู้อนุมัติ and โควตาวันลา (same rows, same filters).
  const [filter, setFilter] = useState({ q: "", dept: "" });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function openTab(key) {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  const notify = (message, type = "success") => setToast({ message, type });
  const shared = { employees, departments: props.departments, notify, filter, setFilter };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0 overflow-x-auto">
        <div role="tablist" aria-label="ตั้งค่าการลา" className="inline-flex gap-1 rounded-xl bg-white p-1" style={{ border: `1px solid ${LINE}` }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`leave-tab-${t.key}`}
                aria-selected={active}
                aria-controls={`leave-panel-${t.key}`}
                onClick={() => openTab(t.key)}
                className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-[9px] px-4 text-[14px] font-medium md:min-h-[40px] ${FOCUS}`}
                style={active ? { background: NAVY, color: "#FFFFFF" } : { color: NAVY }}
                data-testid="leave-tab"
                data-tab={t.key}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`leave-panel-${tab}`} aria-labelledby={`leave-tab-${tab}`} data-testid="leave-panel" data-tab={tab}>
        {tab === "general" && <GeneralTab settings={settings} onSaved={setSettings} {...shared} />}
        {tab === "types" && <TypesTab types={types} setTypes={setTypes} notify={notify} />}
        {tab === "approvers" && <ApproversTab setEmployees={setEmployees} {...shared} />}
        {tab === "quota" && (
          <QuotaTab
            types={types}
            currentFiscalYear={props.currentFiscalYear}
            fiscalYearStartMonth={settings.fiscalYearStartMonth}
            initialEntitlements={props.entitlements}
            {...shared}
          />
        )}
        {tab === "holidays" && (
          <HolidaysTab
            initialYear={props.holidayYear}
            initialHolidays={props.holidays}
            weeklyDaysOff={settings.weeklyDaysOff}
            setWeeklyDaysOff={(weeklyDaysOff) => setSettings((s) => ({ ...s, weeklyDaysOff }))}
            notify={notify}
          />
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-4 right-4 z-[90] flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-medium text-white sm:left-auto"
          style={{ background: toast.type === "error" ? "#991B1B" : "#065F46", boxShadow: "0 8px 32px rgba(13,27,42,0.25)" }}
          data-testid="leave-toast"
          data-type={toast.type}
        >
          {toast.type === "error" ? <X size={16} aria-hidden /> : <Check size={16} aria-hidden />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
