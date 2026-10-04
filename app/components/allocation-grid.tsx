"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, colorSchemeDark, type ColDef } from "ag-grid-community";

export interface Allocation {
  provider_id: string;
  role: string;
  amount_usd: string;
}

/**
 * Provider allocation ledger as an AG Grid data table.
 * Sortable columns + pinned total row. (AG Grid sponsor surface.)
 */
export default function AllocationGrid({ allocations }: { allocations: Allocation[] }) {
  const theme = useMemo(() => themeQuartz.withPart(colorSchemeDark), []);

  const columnDefs = useMemo<ColDef<Allocation>[]>(
    () => [
      { field: "provider_id", headerName: "Provider", sortable: true, filter: true, flex: 1 },
      { field: "role", headerName: "Role", sortable: true, flex: 1.5 },
      {
        field: "amount_usd",
        headerName: "Amount (USD)",
        sortable: true,
        flex: 0.8,
        type: "rightAligned",
        valueFormatter: (p) => `$${Number(p.value ?? 0).toFixed(2)}`,
      },
    ],
    []
  );

  const total = useMemo(
    () => allocations.reduce((s, a) => s + Number(a.amount_usd), 0),
    [allocations]
  );

  const pinnedBottomRowData = useMemo(
    () => [{ provider_id: "Total", role: `${allocations.length} providers`, amount_usd: total.toFixed(2) }],
    [allocations.length, total]
  );

  return (
    <div style={{ height: 245, width: "100%" }}>
      <AgGridReact
        theme={theme}
        rowData={allocations}
        columnDefs={columnDefs}
        pinnedBottomRowData={pinnedBottomRowData}
      />
    </div>
  );
}
