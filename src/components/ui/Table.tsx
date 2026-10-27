import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-surface2 text-xs text-muted">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-line last:border-0 hover:bg-ground/60">{children}</tr>;
}

export function TableCell({
  children,
  nums,
  colSpan,
}: {
  children?: ReactNode;
  nums?: boolean;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 text-ink ${nums ? "tabular-nums" : ""}`}>
      {children}
    </td>
  );
}

export function TableHeaderCell({ children }: { children?: ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}
