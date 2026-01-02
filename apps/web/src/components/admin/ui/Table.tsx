import clsx from "clsx";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: TableProps) {
  return (
    <thead className="bg-navy-800/50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHead({ children, className }: TableProps) {
  return (
    <th
      className={clsx(
        "px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: TableProps) {
  return <tbody className="divide-y divide-navy-800">{children}</tbody>;
}

export function TableRow({ children, className }: TableProps) {
  return <tr className={clsx("hover:bg-navy-800/30 transition-colors", className)}>{children}</tr>;
}

export function TableCell({ children, className }: TableProps) {
  return <td className={clsx("px-4 py-4 text-sm text-navy-300", className)}>{children}</td>;
}
