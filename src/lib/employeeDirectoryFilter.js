/**
 * ข้อมูลพนักงาน filters. Pure — the list page (browser) and the Excel export
 * (server) both run these on the same rows, so the file holds exactly the
 * rows on screen, in the same order.
 */

/** Group key for employees with no (known) department; listed last. */
export const NO_DEPARTMENT = "none";
export const NO_DEPARTMENT_LABEL = "ไม่ระบุแผนก";

/** Lower-case, no whitespace, no dashes: "081-234 5678" → "0812345678". */
export function normalizeSearch(value) {
  return String(value ?? "").toLowerCase().replace(/[\s\-–]+/g, "");
}

/** The text a row is searched by: Thai/English names, nickname, code, position, email, phone. */
export function rowSearchText(r) {
  return normalizeSearch([r.nameTh, r.nameThPlain, r.nameEn, r.nickName, r.code, r.position, r.email, r.phone].filter(Boolean).join("|"));
}

/** Filters from URL params / UI state → { q, dept, noAccount }. */
export function readFilters(params) {
  const get = (k) => (typeof params?.get === "function" ? params.get(k) : params?.[k]) ?? "";
  return { q: String(get("q")), dept: String(get("dept")), noAccount: String(get("noAccount")) === "1" };
}

/** Does a row pass the filters? `r.search` is rowSearchText(r). */
export function rowMatches(r, { q = "", dept = "", noAccount = false } = {}) {
  if (dept && r.deptKey !== dept) return false;
  if (noAccount && r.hasAccount) return false;
  const needle = normalizeSearch(q);
  return !needle || r.search.includes(needle);
}

export const filtersActive = ({ q = "", dept = "", noAccount = false } = {}) => !!normalizeSearch(q) || !!dept || !!noAccount;
