import { Link } from "react-router-dom";
import { Bell, AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const levelIcon = (level: string) => {
  switch (level) {
    case "urgent": return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-warning" />;
    default: return <Info className="h-4 w-4 text-info" />;
  }
};

export const NotificationBell = () => {
  const { items, unreadCount, markAllRead, markRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-accent"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 shadow-elevated">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-8 text-xs">
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <NotifRow key={n.id} n={n} onClick={() => markRead(n.id)} />
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

const NotifRow = ({ n, onClick }: { n: AppNotification; onClick: () => void }) => {
  const inner = (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40",
        !n.read && "bg-primary/[0.04]",
      )}
    >
      <div className="mt-0.5 shrink-0">{levelIcon(n.level)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("text-sm leading-tight", !n.read && "font-semibold")}>
            {n.title}
          </div>
          {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
  return <li>{n.link ? <Link to={n.link}>{inner}</Link> : inner}</li>;
};
