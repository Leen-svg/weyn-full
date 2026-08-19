import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-transparent bg-clip-padding font-[family-name:var(--font-display)] text-sm font-bold whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:translate-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-border bg-primary text-primary-foreground shadow-[3px_3px_0_var(--ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-primary hover:shadow-[4px_4px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--ink)]",
        outline:
          "border-border bg-background shadow-[3px_3px_0_var(--ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-muted hover:text-foreground hover:shadow-[4px_4px_0_var(--ink)] aria-expanded:bg-muted aria-expanded:text-foreground active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--ink)]",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-[3px_3px_0_var(--ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-secondary hover:shadow-[4px_4px_0_var(--ink)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--ink)]",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-border bg-destructive text-destructive-foreground shadow-[3px_3px_0_var(--ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-destructive hover:shadow-[4px_4px_0_var(--ink)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--ink)]",
        link: "text-primary font-medium underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
