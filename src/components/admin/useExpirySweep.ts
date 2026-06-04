import { useEffect, useRef } from "react";
import { ZACAZU_BOT_URL } from "./adminTypes";

/**
 * Пока вкладка открыта и есть заказы «на продаже» — каждые 30 сек дёргает
 * проверку просрочек оплаты (?sweep=1). Если активных заказов нет — не дёргает.
 * Бэкенд сам передаёт заказ следующему в очереди при таймауте 5 минут.
 */
export function useExpirySweep(enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;

    const tick = async () => {
      try {
        const r = await fetch(`${ZACAZU_BOT_URL}?sweep=1`);
        const j = await r.json();
        // Нет заказов на продаже — прекращаем опрос до перезахода во вкладку.
        if (j && j.active_orders === 0) return;
      } catch {
        // молча игнорируем сетевые сбои
      }
      if (!stopped.current) {
        timer.current = setTimeout(tick, 30000);
      }
    };

    tick();

    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled]);
}
