import { ReactNode, useEffect } from "react";
import { usePageHeaderState } from "@/contexts/PageHeaderContext";

/**
 * PageHeader registers ONLY the page title into the global TopHeader bar
 * (so the topbar shows just the page name).
 *
 * The description + actions render inline at the top of the page body,
 * directly below the TopHeader.
 */
export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) => {
  const { setHeader } = usePageHeaderState();
  useEffect(() => {
    setHeader({ title });
    return () => setHeader({ title: "" });
  }, [title, setHeader]);

  if (!description && !actions) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      {description && (
        <p className="hidden sm:block text-sm text-muted-foreground">{description}</p>
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
};
