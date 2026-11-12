/**
 * Department display order, chosen by HR on แผนกและตำแหน่ง ("จัดลำดับ").
 * Pure — browser-safe.
 *
 * Department.sortOrder ascending (saved as 10, 20, 30…); a department with
 * no sortOrder — every department until an order is first saved, or a new
 * one — comes after the ordered ones, by name. Ties (and the no-order case)
 * fall back to the Thai name, then the code. "ไม่ระบุแผนก" is not a
 * department: callers keep it last.
 */

const orderOf = (d) => (typeof d?.sortOrder === "number" && Number.isFinite(d.sortOrder) ? d.sortOrder : null);

export function compareDepartments(a, b) {
  const sa = orderOf(a);
  const sb = orderOf(b);
  if (sa !== sb) {
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  }
  return String(a?.name || "").localeCompare(String(b?.name || ""), "th") || String(a?.code || "").localeCompare(String(b?.code || ""), "en");
}

/** A sorted copy. */
export function sortDepartments(list) {
  return [...(list || [])].sort(compareDepartments);
}

/** Step between saved positions: 10, 20, 30… */
export const SORT_ORDER_STEP = 10;

/** sortOrder for the department at `index` (0-based) of a saved order. */
export const sortOrderAt = (index) => (index + 1) * SORT_ORDER_STEP;
