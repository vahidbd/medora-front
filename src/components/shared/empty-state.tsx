import { Inbox, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * An empty state earns its place: it says why the list is empty and offers
 * the next step. Laid out like the kit's empty list.
 */
export function EmptyState({
  title = "Nothing here yet",
  description = "There are no records to show. Create one to get started.",
  actionLabel,
  onAction,
  icon: Icon = Inbox,
  boxed = true,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ElementType;
  /** Draw the dashed box around it (off when it already sits in a card). */
  boxed?: boolean;
}) {
  const body = (
    <div className="list-empty">
      <div className="empty-icon">
        <Icon />
      </div>
      <div className="empty-title">{title}</div>
      <p className="empty-text">{description}</p>
      {actionLabel && onAction ? (
        <div className="empty-actions">
          <Button variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
  return boxed ? <div className="rounded-lg border border-dashed border-border-strong">{body}</div> : body;
}

/**
 * A page whose record did not load (the API failed), as against one that
 * isn't there: says so, with Try again. Nothing reads it as "not found".
 */
export function LoadFailedState({ noun, onRetry }: { noun: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title={`This ${noun} did not load`}
      description="Nothing has changed. Try again in a moment."
      actionLabel="Try again"
      onAction={onRetry}
    />
  );
}
