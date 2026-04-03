"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Resident {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  unit_number: string | null;
  created_at: string;
}

export function ResidentsTable({ residents }: { residents: Resident[] }) {
  const [search, setSearch] = useState("");

  const filtered = residents.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      (r.unit_number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--nly-text-placeholder)" }}
        />
        <Input
          placeholder="Search residents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border"
          style={{
            backgroundColor: "var(--nly-input-bg)",
            borderColor: "var(--nly-input-border)",
            color: "var(--nly-text-primary)",
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            {residents.length === 0
              ? "No residents in this community yet."
              : "No residents match your search."}
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: "var(--nly-border)" }}>
                <TableHead
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  Name
                </TableHead>
                <TableHead
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  Email
                </TableHead>
                <TableHead
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  Phone
                </TableHead>
                <TableHead
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  Unit
                </TableHead>
                <TableHead
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  style={{ borderColor: "var(--nly-divider)" }}
                >
                  <TableCell
                    className="text-sm font-medium"
                    style={{ color: "var(--nly-text-primary)" }}
                  >
                    {r.full_name}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--nly-text-secondary)" }}
                  >
                    {r.email}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--nly-text-secondary)" }}
                  >
                    {r.phone ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--nly-text-secondary)" }}
                  >
                    {r.unit_number ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--nly-text-tertiary)" }}
                  >
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        Showing {filtered.length} of {residents.length} residents
      </p>
    </div>
  );
}
