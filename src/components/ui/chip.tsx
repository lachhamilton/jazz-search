"use client";

import { cn } from "@/lib/utils";

type ChipProps = {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Chip({ children, selected, onClick, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full border text-sm transition-colors",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary/50 text-foreground border-border hover:bg-secondary",
        className
      )}
    >
      {children}
    </button>
  );
}


