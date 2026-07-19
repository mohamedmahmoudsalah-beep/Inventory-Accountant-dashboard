"use client";

export function DataTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-muted-foreground text-sm">No data available</div>;
  }

  const columns = Object.keys(data[0]).filter((key) => key !== "_id");

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead className="bg-accent/50 sticky top-0">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="hover:bg-accent/30">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-foreground truncate max-w-[150px]">
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
