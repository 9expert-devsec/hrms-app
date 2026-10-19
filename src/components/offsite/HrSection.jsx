"use client";

import {
  ALLOWANCE_OPTIONS,
  ALLOWANCE_OPTION_LABELS,
  DEFAULT_ALLOWANCE_PER_PERSON,
  allowanceNeedsAmount,
  allowanceTotal,
  formatBaht,
} from "@/lib/offsiteRules";
import { Req } from "../FormValidation";
import { INPUT_STYLE, INPUT_ERROR, NAVY, SLATE } from "./ui";

/** Option label with the amount in place of "…" (read-only view). */
function optionText(option, amount) {
  const label = ALLOWANCE_OPTION_LABELS[option] || option;
  return allowanceNeedsAmount(option) ? label.replace("…", amount != null ? formatBaht(amount) : "…") : label;
}

function TotalLine({ value, memberCount }) {
  const t = allowanceTotal(value, memberCount);
  if (!t) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "rgba(0,92,255,0.06)", color: NAVY }} data-testid="hr-total">
      รวม {t.count} ท่าน × {formatBaht(t.amount)} บาท = {formatBaht(t.total)} บาท
    </div>
  );
}

/**
 * "สำหรับฝ่ายบุคคล" (step 3). Editable for the HR approver while step 3 is
 * pending; read-only for everyone else and after approval.
 * `value` = { allowanceOption, amountPerPerson, note }.
 */
export default function HrSection({ value, onChange, editable = false, errors = {}, memberCount }) {
  const v = value || {};

  if (!editable) {
    if (!v.allowanceOption) return <p className="text-sm" style={{ color: SLATE }}>ฝ่ายบุคคลยังไม่ได้กรอก</p>;
    return (
      <div className="space-y-2 text-sm" style={{ color: NAVY }}>
        <div>☑ {optionText(v.allowanceOption, v.amountPerPerson)}</div>
        <TotalLine value={v} memberCount={memberCount} />
        {v.note && (
          <div>
            <span style={{ color: SLATE }}>หมายเหตุ: </span>
            <span style={{ whiteSpace: "pre-wrap" }}>{v.note}</span>
          </div>
        )}
      </div>
    );
  }

  const set = (patch) => onChange({ ...v, ...patch });
  return (
    <div className="space-y-3">
      <fieldset aria-describedby={errors.allowanceOption ? "hr-allowanceOption-error" : undefined}>
        <legend className="mb-2 text-sm font-medium" style={{ color: NAVY }}>
          เบี้ยเลี้ยง / ค่าเดินทาง
          <Req />
        </legend>
        <div className="space-y-2">
          {ALLOWANCE_OPTIONS.map((option) => {
            const [before, after] = ALLOWANCE_OPTION_LABELS[option].split("…");
            const checked = v.allowanceOption === option;
            return (
              <label key={option} className="flex flex-wrap items-center gap-2 text-sm" style={{ color: NAVY }}>
                <input
                  type="radio"
                  name="allowanceOption"
                  checked={checked}
                  onChange={() =>
                    set({
                      allowanceOption: option,
                      // Company policy default, editable.
                      ...(allowanceNeedsAmount(option) && !v.amountPerPerson ? { amountPerPerson: DEFAULT_ALLOWANCE_PER_PERSON } : {}),
                    })
                  }
                />
                <span>{before}</span>
                {allowanceNeedsAmount(option) && (
                  <>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      disabled={!checked}
                      aria-label="จำนวนเงินต่อท่าน (บาท)"
                      aria-invalid={(checked && !!errors.amountPerPerson) || undefined}
                      style={{ ...(checked && errors.amountPerPerson ? INPUT_ERROR : INPUT_STYLE), width: 110, padding: "4px 8px", opacity: checked ? 1 : 0.5 }}
                      value={checked ? v.amountPerPerson ?? "" : ""}
                      onChange={(e) => set({ amountPerPerson: e.target.value === "" ? "" : Number(e.target.value) })}
                    />
                    <span>{after}</span>
                  </>
                )}
              </label>
            );
          })}
        </div>
        {errors.allowanceOption && <p id="hr-allowanceOption-error" className="mt-1 text-xs text-red-500">{errors.allowanceOption}</p>}
        {errors.amountPerPerson && <p className="mt-1 text-xs text-red-500">{errors.amountPerPerson}</p>}
      </fieldset>
      <TotalLine value={v} memberCount={memberCount} />
      <label className="block text-sm font-medium" style={{ color: NAVY }}>
        หมายเหตุ
        <textarea rows={2} className="mt-1" style={INPUT_STYLE} value={v.note || ""} onChange={(e) => set({ note: e.target.value })} />
      </label>
      {errors.note && <p className="text-xs text-red-500">{errors.note}</p>}
    </div>
  );
}
