import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: Props) {
  return (
    <span className={cn("px-2 py-1 text-xs font-medium rounded-full capitalize", className)}>
      {children}
    </span>
  );
}
