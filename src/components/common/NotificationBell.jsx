import { useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, BellRing, CheckCheck, Loader2 } from "lucide-react";

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export default function NotificationBell({ onOpenTicket }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  async function loadNotifications() {
    setLoading(true);
    setError("");
    try {
      const data = await api.notifications({ limit: 40 });
      setItems(data.items || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  const unreadIds = useMemo(() => items.filter((item) => !item.read_at).map((item) => item.id), [items]);

  async function markAllRead() {
    await api.markAllNotificationsRead();
    await loadNotifications();
  }

  async function markRead(id) {
    await api.markNotificationsRead([id]);
    await loadNotifications();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Notifications" className="relative">
          {unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-black">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[92vw] max-w-[430px] p-0">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Notification Center</p>
              <p className="text-xs text-muted-foreground">Assignments and updates</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={markAllRead} disabled={unreadIds.length === 0}>
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
            </Button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {loading ? <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading notifications...</div> : null}
          {error ? <p className="p-3 text-sm text-red-400">{error}</p> : null}
          {!loading && !error && items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p> : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mb-2 w-full rounded-md border p-3 text-left transition-colors hover:bg-muted ${item.read_at ? "border-border bg-background" : "border-emerald-500/40 bg-emerald-500/5"}`}
              onClick={async () => {
                if (!item.read_at) await markRead(item.id);
                if (item.work_order_id) {
                  onOpenTicket?.(item);
                  setOpen(false);
                }
              }}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{item.title}</p>
                {!item.read_at ? <Badge className="bg-emerald-500 text-black">New</Badge> : null}
              </div>
              {item.body ? <p className="text-xs text-muted-foreground">{item.body}</p> : null}
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{item.assigned_by_name || item.payload?.assignedByName || "TurfOp"}</span>
                <span>{formatWhen(item.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
