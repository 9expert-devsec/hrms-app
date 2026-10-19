import { FIELD_LABELS } from "@/lib/employeeFormRules";

/**
 * Pieces for visible form validation (employee create / edit forms;
 * rules in lib/employeeFormRules.js).
 */

/** Red required marker after a label. Screen readers get aria-required instead. */
export function Req() {
  return (
    <span className="text-red-500" aria-hidden="true">
      {" "}*
    </span>
  );
}

/** The message under a field; `id` matches the input's aria-describedby. */
export function FieldError({ k, errors, prefix = "emp" }) {
  const message = errors?.[k];
  if (!message) return null;
  return (
    <p id={`${prefix}-${k}-error`} className="mt-1 text-xs text-red-500">
      {message}
    </p>
  );
}

/**
 * Red box above the buttons: the count and names of the fields to fix, and
 * a server error (also shown on its field when the API names one).
 */
export function ErrorSummary({ errorKeys = [], serverError = null, serverOnField = false }) {
  const clientKeys = serverOnField ? errorKeys.filter((k) => k !== serverError?.field) : errorKeys;
  if (!clientKeys.length && !serverError) return null;
  return (
    <div
      role="alert"
      className="rounded-xl px-4 py-3 text-sm"
      style={{ background: "#FEE2E2", border: "1px solid #FECACA", color: "#991B1B" }}
    >
      {clientKeys.length > 0 && (
        <>
          <div className="font-semibold">กรุณากรอกข้อมูลให้ครบ {clientKeys.length} รายการ</div>
          <ul className="mt-1 list-disc pl-5">
            {clientKeys.map((k) => (
              <li key={k}>{FIELD_LABELS[k] || k}</li>
            ))}
          </ul>
        </>
      )}
      {serverError && (
        <div className={clientKeys.length ? "mt-2" : "font-semibold"}>
          {serverError.field && FIELD_LABELS[serverError.field] ? `${FIELD_LABELS[serverError.field]}: ` : ""}
          {serverError.message}
        </div>
      )}
    </div>
  );
}
