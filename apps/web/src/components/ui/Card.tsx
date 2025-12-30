import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: Props) {
  return (
    <div
      className={cn(
        "bg-navy-900 border border-navy-800 rounded-lg",
        className
      )}
    >
      {children}
    </div>
  );
}
