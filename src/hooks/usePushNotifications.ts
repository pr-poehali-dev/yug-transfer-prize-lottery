import { useState, useEffect } from "react";

const PUSH_URL = "https://functions.poehali.dev/0b609b6c-8c5c-4291-8ad1-6f757c5a438b";

export type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export function usePushNotifications(userId?: number) {
  const [status, setStatus] = useState<PushStatus>("loading");

  const isSupported = "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!isSupported) { setStatus("unsupported"); return; }
    checkStatus();
  }, []);

  const checkStatus = async () => {
    if (!isSupported) return;
    const perm = Notification.permission;
    if (perm === "denied") { setStatus("denied"); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  };

  const getVapidKey = async (): Promise<string> => {
    const res = await fetch(PUSH_URL);
    const data = await res.json();
    return data.public_key || "";
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  };

  const subscribe = async () => {
    if (!isSupported) return;
    setStatus("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return; }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = await getVapidKey();
      if (!vapidKey) { setStatus("unsubscribed"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await fetch(PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "X-User-Id": String(userId) } : {}),
        },
        body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON() }),
      });

      setStatus("subscribed");
    } catch {
      setStatus("unsubscribed");
    }
  };

  const unsubscribe = async () => {
    if (!isSupported) return;
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  };

  return { status, subscribe, unsubscribe, isSupported };
}
