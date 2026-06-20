import { useEffect, useState } from "react";

const BRIDGE_NEWS_URL = "https://functions.poehali.dev/3af26657-db34-4fcf-9d05-41d0122fbe3b";

type BridgeStatus = "open" | "limited" | "closed";

const DOT: Record<BridgeStatus, { ping: string; core: string }> = {
  open: { ping: "bg-green-400", core: "bg-green-500" },
  limited: { ping: "bg-amber-400", core: "bg-amber-500" },
  closed: { ping: "bg-red-400", core: "bg-red-500" },
};

export default function BridgeStatusDot({ className = "h-2.5 w-2.5" }: { className?: string }) {
  const [status, setStatus] = useState<BridgeStatus>("open");

  useEffect(() => {
    let active = true;
    fetch(`${BRIDGE_NEWS_URL}?t=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d.status) setStatus(d.status as BridgeStatus);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const dot = DOT[status] || DOT.open;

  return (
    <span className={`relative flex shrink-0 ${className}`}>
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dot.ping}`} />
      <span className={`relative inline-flex h-full w-full rounded-full ${dot.core}`} />
    </span>
  );
}