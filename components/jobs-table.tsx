"use client";

import * as React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobSheet } from "@/components/job-sheet";
import { timeAgo } from "@/lib/utils";
import type { JobRow, ProfileRow } from "@/lib/supabase/database.types";

export function JobsTable({
  jobs,
  companyName,
  atsLabel,
  profile,
  isAuthed,
}: {
  jobs: JobRow[];
  companyName: string;
  atsLabel: string;
  profile: ProfileRow | null;
  isAuthed: boolean;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [department, setDepartment] = React.useState<string>("all");
  const [remoteOnly, setRemoteOnly] = React.useState(false);
  const [earlyOnly, setEarlyOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<JobRow | null>(null);

  const departments = React.useMemo(
    () =>
      [...new Set(jobs.map((j) => j.department).filter(Boolean))].sort() as string[],
    [jobs],
  );

  const filtered = React.useMemo(
    () =>
      jobs.filter((j) => {
        if (remoteOnly && !j.is_remote) return false;
        if (earlyOnly && !j.is_early_career) return false;
        if (department !== "all" && j.department !== department) return false;
        return true;
      }),
    [jobs, remoteOnly, earlyOnly, department],
  );

  const columns = React.useMemo<ColumnDef<JobRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Role <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.is_early_career && (
              <GraduationCap className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <span className="font-medium">{row.original.title}</span>
          </div>
        ),
        filterFn: "includesString",
      },
      {
        id: "location",
        accessorFn: (r) => (r.locations.length ? r.locations.join(", ") : r.location_raw ?? ""),
        header: "Location",
        cell: ({ getValue, row }) => (
          <span className="text-muted-foreground">
            {row.original.is_remote ? "Remote" : (getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "department",
        header: "Team",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "posted_at",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Posted <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {getValue() ? timeAgo(getValue() as string) : "—"}
          </span>
        ),
        sortingFn: "datetime",
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter roles…"
            className="pl-8"
          />
        </div>

        {departments.length > 0 && (
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-2">
          <Switch id="remote" checked={remoteOnly} onCheckedChange={setRemoteOnly} />
          <Label htmlFor="remote" className="cursor-pointer">
            Remote
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="early" checked={earlyOnly} onCheckedChange={setEarlyOnly} />
          <Label htmlFor="early" className="cursor-pointer">
            Early career
          </Label>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No roles match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {table.getFilteredRowModel().rows.length} role
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
          {earlyOnly && (
            <Badge variant="outline" className="ml-2 font-normal">
              early career only
            </Badge>
          )}
        </span>
        {table.getPageCount() > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <JobSheet
        job={selected}
        companyName={companyName}
        atsLabel={atsLabel}
        profile={profile}
        isAuthed={isAuthed}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}
