"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

/**
 * Shared class for select triggers used inside form dialogs. Makes the trigger
 * visually identical to the `Input` component: a light `--nly-input-bg` tile
 * with dark `--nly-input-text` text, h-10, rounded-xl, light border.
 *
 * `!important` (the `!` prefix) is required because twMerge keeps the base
 * trigger's `dark:bg-input/30` / `dark:hover:bg-input/50` rules (different
 * variant group than plain `bg-*`), and under the `.dark` ancestor those would
 * otherwise win over a normal-weight utility. Text/border are forced directly
 * (not via the globals.css `--nly-text-primary` rebind) so the look does not
 * depend on inline style + variable-inheritance chains.
 */
const formSelectTriggerClassName = cn(
  "!h-10 w-full rounded-xl px-3.5",
  "!bg-[var(--nly-input-bg)] !text-[var(--nly-input-text)] !border-[var(--nly-input-border)]",
  // selected value span + placeholder + chevron icon all read dark on the light tile
  "*:data-[slot=select-value]:!text-[var(--nly-input-text)]",
  "data-placeholder:!text-[var(--nly-input-placeholder)]",
  "[&_svg]:!text-[var(--nly-input-text)]"
)

/**
 * Shared class for the OPEN dropdown panel inside form dialogs. Makes the panel
 * match the light `formSelectTriggerClassName` trigger and the `Input` fields:
 * light `--nly-input-bg` surface, dark `--nly-input-text` text.
 *
 * The base popup class carries `bg-popover text-popover-foreground` (dark under
 * `.dark`) plus `ring-1 ring-foreground/10`. On a light panel that ring reads as
 * a jarring white outline, so we force a faint dark hairline matching the input
 * border instead. `!important` (the `!` prefix) is required: a plain-weight
 * utility loses to the base `bg-popover` once both survive twMerge, and the
 * `.dark` ancestor would otherwise re-darken the surface/text.
 */
const formSelectContentClassName = cn(
  "!bg-[var(--nly-input-bg)] !text-[var(--nly-input-text)]",
  // tame the white-on-light ring artifact: keep a 1px ring but tint it the
  // faint input border so it reads as a subtle hairline, not a white outline
  "!ring-[var(--nly-input-border)]"
)

/**
 * Shared class for items inside a form-variant dropdown panel. Items read dark
 * on the light panel; the highlighted/focused item gets a SUBTLE brand tint
 * (not the base charcoal `focus:bg-accent`) while its label text — including
 * descendant spans — stays dark; the selected item gets a slightly stronger
 * tint; the check svg is brand-colored.
 *
 * Specificity / ordering notes (why each `!` lands where intended):
 * - The base item class sets `focus:bg-accent focus:text-accent-foreground` and
 *   `not-data-[variant=destructive]:focus:**:text-accent-foreground`. We cover
 *   BOTH the `focus:` and `data-[highlighted]:` states (base-ui sets
 *   `data-highlighted` on the active item; `focus:` also fires) and force dark
 *   text on the item AND its descendants (`**:`) so the label never goes light.
 * - The check stays brand on highlight because `[&_svg]:` (a descendant-combinator
 *   selector, specificity 0,1,1) outranks the universal-descendant `**:`
 *   utility (`* { ... }`, specificity 0,1,0); both are `!important`, so the more
 *   specific `[&_svg]` color wins regardless of source order.
 */
const formSelectItemClassName = cn(
  "!text-[var(--nly-input-text)]",
  // highlighted / focused: subtle brand tint, dark text on item + descendants
  "focus:!bg-[rgba(47,196,211,0.12)] data-[highlighted]:!bg-[rgba(47,196,211,0.12)]",
  "focus:!text-[var(--nly-input-text)] data-[highlighted]:!text-[var(--nly-input-text)]",
  "focus:**:!text-[var(--nly-input-text)] data-[highlighted]:**:!text-[var(--nly-input-text)]",
  // selected: slightly stronger tint
  "data-[selected]:!bg-[rgba(47,196,211,0.18)]",
  // the check indicator stays brand-colored (even while highlighted)
  "[&_svg]:!text-[var(--nly-brand)]"
)

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
  /**
   * `"form"` makes the trigger match the `Input` field look (light tile, dark
   * text) for use inside form dialogs. Defaults to the shadcn look.
   */
  variant?: "default" | "form"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variant === "form" && formSelectTriggerClassName,
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  variant = "default",
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  > & {
    /**
     * `"form"` makes the open panel match the light `variant="form"` trigger and
     * the `Input` fields. Defaults to the shadcn (dark popover) look.
     */
    variant?: "default" | "form"
  }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", variant === "form" && formSelectContentClassName, className )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  variant = "default",
  ...props
}: SelectPrimitive.Item.Props & {
  /**
   * `"form"` makes the item match the light form panel: dark label text, a
   * subtle brand-tinted highlight (instead of charcoal), and a brand check.
   */
  variant?: "default" | "form"
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        variant === "form" && formSelectItemClassName,
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
