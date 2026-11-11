import { cn } from "@/lib/utils";

export function EggLogo({ className }: { className?: string }) {
  return (
    <div className={cn("egg-shape relative bg-yolk shadow-yolk", className)} aria-hidden="true">
      <div className="egg-shape absolute left-[22%] top-[18%] h-[28%] w-[22%] bg-card/50" />
    </div>
  );
}
