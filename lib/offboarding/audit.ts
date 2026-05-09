import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry } from "./types";

type AuditableTable = "deletion_requests" | "transfer_requests";

export async function appendAudit(
  admin: SupabaseClient,
  table: AuditableTable,
  requestId: string,
  entry: Omit<AuditEntry, "at"> & { at?: string },
): Promise<void> {
  const fullEntry: AuditEntry = {
    ...entry,
    at: entry.at ?? new Date().toISOString(),
  };

  // Atomic SQL append — prevents read-modify-write races that silently drop
  // entries when two writers append concurrently.
  const { error } = await admin.rpc("append_audit_entry", {
    p_table: table,
    p_request_id: requestId,
    p_entry: fullEntry,
  });

  if (error) {
    throw new Error(
      `appendAudit: could not append to ${table}/${requestId}: ${error.message}`,
    );
  }
}
