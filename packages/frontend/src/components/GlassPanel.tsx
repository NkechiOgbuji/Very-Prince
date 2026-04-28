import type { HTMLAttributes, ReactNode } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
}

export function GlassPanel({ className = "", ...props }: GlassPanelProps) {
  return (
    <div
      className={`glass-panel ${className}`.trim()}
      {...props}
    />
  );
}
