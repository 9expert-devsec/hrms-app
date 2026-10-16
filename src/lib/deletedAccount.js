/**
 * What a stored user id shows once that account has been deleted
 * (lib/accountLinks.js deleteAccount). History records keep the raw id and
 * are never rewritten; readers that resolve the id to a user substitute this
 * instead of null, so screens print "บัญชีถูกลบ" rather than a blank.
 * Pure — safe in the browser.
 */
export const DELETED_ACCOUNT_LABEL = "บัญชีถูกลบ";

export function deletedAccount(id) {
  return { _id: id ? String(id) : null, email: null, role: null, deleted: true, label: DELETED_ACCOUNT_LABEL };
}

/** Display text for a resolved user reference ({ email } | deletedAccount() | null). */
export function accountLabel(ref) {
  if (!ref) return "—";
  if (ref.deleted) return DELETED_ACCOUNT_LABEL;
  return ref.email || DELETED_ACCOUNT_LABEL;
}
