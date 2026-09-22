import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "./input";
import { Button } from "./button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "./table";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type DataTableColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  globalFilterAccessorKey?: (keyof TData)[];
  searchPlaceholder?: string;
  loading?: boolean;
  /** Oculta a barra "Pesquisar..." interna (útil quando já há busca externa). */
  hideSearch?: boolean;
  /** Oculta a paginação (útil em prévias curtas dentro de modal). */
  hidePagination?: boolean;
  /** Conteúdo extra à direita do texto da página, antes do botão Próxima (ex.: Baixar todos). */
  paginationExtra?: React.ReactNode;
  /** Atributo data-pendencia-id na linha (deep link do gestor de pendências). */
  getRowDataId?: (row: TData) => string | number | null | undefined;
  /** Mensagem quando não há linhas (padrão do sistema). */
  emptyMessage?: string;
  /** Centraliza cabeçalhos e células (útil em modais). */
  centered?: boolean;
  /** Classes extras na tabela (ex.: table-fixed w-full). */
  tableClassName?: string;
  /** Classes extras no campo de pesquisa. */
  searchClassName?: string;
  /** Linhas por página (padrão: 10). */
  pageSize?: number;
}

export function DataTable<TData>({
  columns,
  data,
  globalFilterAccessorKey,
  searchPlaceholder = "Pesquisar...",
  loading,
  hideSearch = false,
  hidePagination = false,
  paginationExtra,
  getRowDataId,
  emptyMessage = "Nenhum registro encontrado.",
  centered = false,
  tableClassName,
  searchClassName,
  pageSize = 10,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting },
    initialState: { pagination: { pageSize } },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: hidePagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      if (!globalFilterAccessorKey?.length) return true;
      const q = String(filterValue ?? "").trim().toLowerCase();
      if (!q) return true;
      return globalFilterAccessorKey.some((key) =>
        String(row.original[key] ?? "").toLowerCase().includes(q)
      );
    },
  });

  const footerGroups = table.getFooterGroups();
  const hasFooter = footerGroups.some((group) =>
    group.headers.some(
      (header) => !header.isPlaceholder && header.column.columnDef.footer
    )
  );

  return (
    <div>
      {!hideSearch && (
        <div className={cn("mb-4 flex", centered && "justify-center")}>
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cn(centered ? "max-w-md w-full" : "flex-1", searchClassName)}
          />
        </div>
      )}
      <Table className={tableClassName}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortingState = header.column.getIsSorted();
                const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
                return (
                  <TableHead
                    key={header.id}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    className={cn(
                      centered && "text-center",
                      canSort && "cursor-pointer select-none",
                      meta?.headerClassName
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort && (
                      <span className="inline-block ml-2 align-middle">
                        {sortingState === "asc" ? (
                          <ChevronUp className="inline-block h-4 w-4" />
                        ) : sortingState === "desc" ? (
                          <ChevronDown className="inline-block h-4 w-4" />
                        ) : null}
                      </span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                {loading ? "Carregando…" : emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-pendencia-id={getRowDataId?.(row.original) ?? undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(centered && "text-center", meta?.cellClassName)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
        {hasFooter && (
          <TableFooter>
            {footerGroups.map((footerGroup) => (
              <TableRow key={footerGroup.id}>
                {footerGroup.headers.map((header) => (
                  <TableCell key={header.id} className="bg-muted font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.footer,
                        header.getContext()
                      )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableFooter>
        )}
      </Table>
      {!hidePagination && data.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || loading}
          >
            Anterior
          </Button>
          <span className="text-center text-sm text-muted-foreground sm:flex-1">
            Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
            {' · '}
            {data.length} registro{data.length === 1 ? '' : 's'}
          </span>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {paginationExtra}
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage() || loading}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
