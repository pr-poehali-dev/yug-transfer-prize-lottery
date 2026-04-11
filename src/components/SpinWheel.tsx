import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const SPIN_URL = "https://functions.poehali.dev/9eba717e-47b3-4a6b-add1-02c8a4a67974";
const POLL_INTERVAL = 3000;

interface Participant {
  id: number;
  name: string;
  photo: string;
}

interface Spin {
  id: number;
  raffle_title: string;
  participants: Participant[];
  winner_name: string;
  winner_photo: string;
  status: string;
  started_at: string;
  reveal_at: string;
}

function useCountdown(targetIso: string) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [targetIso]);
  return secs;
}

// Рисует колесо на canvas
function WheelCanvas({ participants, spinning, winnerIndex }: { participants: Participant[]; spinning: boolean; winnerIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number>(0);
  const speedRef = useRef(0.18);

  const colors = [
    "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#059669",
    "#d97706", "#dc2626", "#7c3aed", "#be185d", "#0284c7",
  ];

  const draw = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const n = participants.length;
    const R = canvas.width / 2;
    const slice = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    participants.forEach((p, i) => {
      const start = angle + i * slice;
      const end = start + slice;
      ctx.beginPath();
      ctx.moveTo(R, R);
      ctx.arc(R, R, R - 4, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Текст
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(start + slice / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(10, Math.min(14, 180 / n))}px sans-serif`;
      const label = p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name;
      ctx.fillText(label, R - 14, 4);
      ctx.restore();
    });

    // Центр
    ctx.beginPath();
    ctx.arc(R, R, 28, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a0533";
    ctx.fill();
    ctx.strokeStyle = "rgba(168,85,247,0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Стрелка (указатель сверху)
    ctx.save();
    ctx.translate(R, 0);
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-14, -22);
    ctx.lineTo(14, -22);
    ctx.closePath();
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    if (!spinning) return;
    let decelStart = false;
    let targetAngle: number | null = null;

    // Угол победителя — чтобы он оказался под стрелкой (сверху = -π/2)
    const n = participants.length;
    const slice = (2 * Math.PI) / n;
    // Победитель: winnerIndex-й сектор должен быть под стрелкой
    // Стрелка сверху = 0 угла (12 часов), поэтому победный угол = -(winnerIndex * slice + slice/2)
    const winAngle = -(winnerIndex * slice + slice / 2);

    const animate = () => {
      const speed = speedRef.current;

      if (!decelStart && speed > 0.04) {
        // ускорение в начале
        if (speedRef.current < 0.18) speedRef.current += 0.003;
      }

      // Начинаем тормозить за ~10 секунд до reveal
      const timeLeft = (new Date((canvasRef.current as unknown as Record<string, string>)?._revealAt || Date.now()).getTime() - Date.now()) / 1000;
      if (timeLeft < 10 && !decelStart) {
        decelStart = true;
        // Считаем целевой угол с учётом полных оборотов
        const current = angleRef.current % (2 * Math.PI);
        const fullRotations = Math.floor(angleRef.current / (2 * Math.PI)) + 5;
        targetAngle = fullRotations * 2 * Math.PI + winAngle;
      }

      if (decelStart && targetAngle !== null) {
        const diff = targetAngle - angleRef.current;
        if (diff > 0.002) {
          speedRef.current = Math.max(0.002, diff * 0.04);
          angleRef.current += speedRef.current;
        } else {
          angleRef.current = targetAngle;
          draw(angleRef.current);
          return;
        }
      } else {
        angleRef.current += speedRef.current;
      }

      draw(angleRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, winnerIndex, participants]);

  useEffect(() => {
    if (!spinning) draw(angleRef.current);
  }, [participants]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className="rounded-full w-full max-w-[280px] h-auto"
      style={{ filter: "drop-shadow(0 0 32px rgba(168,85,247,0.5))" }}
    />
  );
}

export function SpinWheel() {
  const [spin, setSpin] = useState<Spin | null>(null);
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(0);

  const secsLeft = useCountdown(spin?.reveal_at || new Date().toISOString());

  // Поллинг каждые 3 сек
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(SPIN_URL);
        const data = await res.json();
        if (!data.ok || !data.spin) { setSpin(null); setVisible(false); return; }

        const s: Spin = data.spin;
        const now = Date.now();
        const revealAt = new Date(s.reveal_at).getTime();
        const startedAt = new Date(s.started_at).getTime();

        // Показываем только если спин свежий (не старше 90 секунд после reveal)
        if (now > revealAt + 90_000) { setSpin(null); setVisible(false); return; }

        setSpin(s);
        setVisible(true);

        // Находим индекс победителя
        const idx = s.participants.findIndex(p => p.name === s.winner_name);
        setWinnerIndex(idx >= 0 ? idx : 0);

        if (now >= revealAt) setRevealed(true);
        else setRevealed(false);
      } catch { /* ignore */ }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Авто-раскрытие победителя
  useEffect(() => {
    if (!spin) return;
    const revealAt = new Date(spin.reveal_at).getTime();
    const delay = revealAt - Date.now();
    if (delay <= 0) { setRevealed(true); return; }
    const t = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(t);
  }, [spin?.reveal_at]);

  if (!visible || !spin) return null;

  const spinning = !revealed;
  const participants = spin.participants || [];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <div className="relative w-full max-w-md max-h-[95dvh] flex flex-col animate-scale-in" style={{ animationFillMode: "forwards" }}>
        {/* Свечение */}
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/40 via-pink-600/40 to-orange-500/40 rounded-[2rem] blur-2xl animate-pulse pointer-events-none" />

        <div className="relative glass rounded-3xl p-5 border border-purple-500/30 text-center overflow-y-auto flex-1">
          {/* Заголовок */}
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wider mb-3 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              LIVE · Идёт розыгрыш
            </div>
            <h2 className="font-oswald text-2xl font-bold text-white">{spin.raffle_title}</h2>
            <p className="text-muted-foreground text-sm mt-1">{participants.length} участников</p>
          </div>

          {/* Колесо */}
          <div className="flex justify-center mb-4">
            {participants.length > 1 ? (
              <WheelCanvas
                participants={participants}
                spinning={spinning}
                winnerIndex={winnerIndex}
              />
            ) : (
              <div className="w-full max-w-[280px] aspect-square rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mx-auto">
                <p className="text-white font-bold text-xl px-4 text-center">
                  {participants[0]?.name || "—"}
                </p>
              </div>
            )}
          </div>

          {/* Таймер или победитель */}
          {spinning ? (
            <div>
              <p className="text-muted-foreground text-sm mb-2">Победитель будет объявлен через</p>
              <p className="font-oswald text-5xl font-bold grad-text tabular-nums">{secsLeft}с</p>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-purple-300">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                Колесо крутится в реальном времени
              </div>
            </div>
          ) : (
            <div className="animate-scale-in">
              <div className="text-5xl mb-3">🏆</div>
              <p className="text-muted-foreground text-sm mb-1">Победитель розыгрыша</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                {spin.winner_photo ? (
                  <img src={spin.winner_photo} className="w-12 h-12 rounded-2xl object-cover border-2 border-yellow-400/50" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl font-bold text-white">
                    {spin.winner_name[0]?.toUpperCase()}
                  </div>
                )}
                <p className="font-oswald text-3xl font-bold text-white">{spin.winner_name}</p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-bold">
                <Icon name="Trophy" size={16} />
                Поздравляем победителя!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}