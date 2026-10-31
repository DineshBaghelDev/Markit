// Contacts to (re)draft: the given one, or every selected one. Sent emails are locked, so they are skipped.
export function draftTargets<C extends { _id: string; selected: boolean }>(
  contacts: C[], drafts: { contactId: string; status: string }[], contactId?: string,
): C[] {
  const sent = new Set(drafts.filter((d) => d.status === "sent").map((d) => d.contactId));
  const wanted = contacts.filter((c) => (contactId ? c._id === contactId : c.selected));
  if (!wanted.length) throw new Error("Select at least one contact.");
  const targets = wanted.filter((c) => !sent.has(c._id));
  if (!targets.length) throw new Error(contactId ? "This email was already sent; it cannot be regenerated." : "Every selected contact has already been emailed.");
  return targets;
}
