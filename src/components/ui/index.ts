// Design-system primitives (shadcn/ui style on Base UI, styled with tokens).
//
// These are adapted by hand, not generated: the repo has no components.json on purpose.
// `npx shadcn add` would write kebab-case files (button.tsx) that collide with these
// PascalCase ones on case-insensitive filesystems (Windows/macOS), and its output uses
// shadcn token names (bg-popover, text-muted-foreground, ring-ring...) that globals.css
// does not define. To add a primitive, copy it from the shadcn Base UI docs into a
// PascalCase file and re-tokenise it (surface-raised, fg-muted, focus-ring, border-strong,
// bg-muted, surface); the ESLint guardrails flag anything left untokenised.
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";
export { Spinner } from "./Spinner";
export { Input, Textarea, type InputProps, type TextareaProps } from "./Input";
export { Field, useFieldControl, type FieldProps } from "./Field";
export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { RadioGroup, RadioGroupItem, type RadioGroupProps, type RadioGroupItemProps } from "./RadioGroup";
export { Slider, type SliderProps } from "./Slider";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./Sheet";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants } from "./Card";
export { Badge, badgeVariants, type BadgeProps } from "./Badge";
export { Rating, RatingInput, type RatingProps, type RatingInputProps } from "./Rating";
export { Price, type PriceProps } from "./Price";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Skeleton, ProductCardSkeleton, ProductListSkeleton } from "./Skeleton";
export { QuantitySelector, type QuantitySelectorProps } from "./QuantitySelector";
export { Toaster, showToast, toast } from "./Toast";
export { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";
export { ThemeToggle } from "./ThemeToggle";
