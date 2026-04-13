import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTick(pitch = 800, vol = 0.12) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch { /* */ }
}

function playWinnerFanfare() {
  try {
    const ctx = getAudioCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch { /* */ }
}

interface Participant {
  id: number;
  name: string;
  ticket: number;
}

const DEMO_PARTICIPANTS: Participant[] = [
  { id: 1, name: "Константин", ticket: 1 },
  { id: 2, name: "Иван", ticket: 2 },
  { id: 3, name: "Роман", ticket: 3 },
  { id: 4, name: "Сергей", ticket: 4 },
  { id: 5, name: "Андрей", ticket: 5 },
  { id: 6, name: "Вова", ticket: 6 },
  { id: 7, name: "Фарзин", ticket: 7 },
  { id: 8, name: "Тамила", ticket: 8 },
  { id: 9, name: "Геворк", ticket: 9 },
  { id: 10, name: "Багавутдин", ticket: 10 },
  { id: 11, name: "Сергей К.", ticket: 11 },
  { id: 12, name: "Александр", ticket: 12 },
];

const COLORS = [
  "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#6d28d9", "#be185d", "#0284c7",
  "#15803d", "#c2410c",
];

const DEMO_DURATION = 15;

function DemoWheel({
  participants,
  spinning,
  winnerIndex,
  startTime,
  duration,
  onStopped,
}: {
  participants: Participant[];
  spinning: boolean;
  winnerIndex: number;
  startTime: number;
  duration: number;
  onStopped: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const stoppedRef = useRef(false);
  const angleRef = useRef(0);
  const lastSectorRef = useRef(-1);

  const n = participants.length;
  const slice = (2 * Math.PI) / n;

  const draw = useCallback(
    (angle: number, highlightWinner: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const size = canvas.width;
      const R = size / 2;
      const r = R - 6;
      ctx.clearRect(0, 0, size, size);

      participants.forEach((p, i) => {
        const start = angle + i * slice;
        const end = start + slice;
        const isWinner = highlightWinner && i === winnerIndex;
        const isDimmed = highlightWinner && i !== winnerIndex;

        ctx.beginPath();
        ctx.moveTo(R, R);
        ctx.arc(R, R, r, start, end);
        ctx.closePath();

        if (isDimmed) {
          ctx.fillStyle = "rgba(30,20,40,0.85)";
        } else {
          ctx.fillStyle = COLORS[i % COLORS.length];
        }
        ctx.fill();

        ctx.strokeStyle = isDimmed ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.2)";
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isWinner) {
          ctx.save();
          ctx.shadowColor = "#facc15";
          ctx.shadowBlur = 20;
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(R, R);
          ctx.arc(R, R, r, start, end);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(R, R);
        ctx.rotate(start + slice / 2);
        ctx.textAlign = "right";

        const fontSize = Math.max(9, Math.min(14, 160 / n));
        ctx.font = `bold ${fontSize}px sans-serif`;

        const ticketLabel = `#${p.ticket}`;
        const nameLabel = p.name.length > 10 ? p.name.slice(0, 9) + "…" : p.name;
        const fullLabel = `${ticketLabel} ${nameLabel}`;

        if (isDimmed) {
          ctx.fillStyle = "rgba(255,255,255,0.15)";
        } else if (isWinner) {
          ctx.fillStyle = "#facc15";
        } else {
          ctx.fillStyle = "#fff";
        }

        ctx.fillText(fullLabel, r - 14, fontSize / 3);
        ctx.restore();
      });

      ctx.beginPath();
      ctx.arc(R, R, 26, 0, 2 * Math.PI);
      ctx.fillStyle = "#1a0533";
      ctx.fill();
      ctx.strokeStyle = "rgba(168,85,247,0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.translate(R, 6);
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(-12, -4);
      ctx.lineTo(12, -4);
      ctx.closePath();
      ctx.fillStyle = "#facc15";
      ctx.fill();
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    },
    [participants, winnerIndex, n, slice]
  );

  useEffect(() => {
    if (!spinning) {
      draw(angleRef.current, stoppedRef.current);
      return;
    }

    stoppedRef.current = false;
    lastSectorRef.current = -1;
    const totalDuration = duration * 1000;

    const winAngle = -(winnerIndex * slice + slice / 2);
    const totalRotations = 10 + Math.random() * 5;
    const finalAngle = totalRotations * 2 * Math.PI + winAngle;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalDuration);

      const eased = 1 - Math.pow(1 - progress, 3);
      angleRef.current = finalAngle * eased;

      const pointerAngle = (((-angleRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
      const currentSector = Math.floor(pointerAngle / slice) % n;
      if (currentSector !== lastSectorRef.current && lastSectorRef.current !== -1) {
        const speed = progress < 0.1 ? progress / 0.1 : Math.pow(1 - ((progress - 0.1) / 0.9), 2.5);
        const pitch = 600 + speed * 600;
        const vol = Math.max(0.03, Math.min(0.15, speed * 0.2));
        playTick(pitch, vol);
      }
      lastSectorRef.current = currentSector;

      draw(angleRef.current, false);

      if (progress >= 1) {
        angleRef.current = finalAngle;
        stoppedRef.current = true;
        draw(angleRef.current, true);
        playWinnerFanfare();
        onStopped();
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, winnerIndex, startTime, duration, draw, slice, n, onStopped]);

  useEffect(() => {
    if (!spinning) draw(angleRef.current, stoppedRef.current);
  }, [participants, spinning, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={380}
      height={380}
      className="rounded-full w-full max-w-[320px] h-auto mx-auto"
      style={{ filter: "drop-shadow(0 0 40px rgba(168,85,247,0.5))" }}
    />
  );
}

export function SpinWheelDemo({ onClose }: { onClose: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [secsLeft, setSecsLeft] = useState(0);
  const [duration, setDuration] = useState(DEMO_DURATION);

  useEffect(() => {
    if (!spinning || stopped) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((startTime + duration * 1000 - Date.now()) / 1000));
      setSecsLeft(left);
    }, 200);
    return () => clearInterval(id);
  }, [spinning, stopped, startTime, duration]);

  const handleStart = () => {
    try {
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
    } catch { /* */ }
    const idx = Math.floor(Math.random() * DEMO_PARTICIPANTS.length);
    setWinnerIndex(idx);
    setStartTime(Date.now());
    setSecsLeft(duration);
    setStopped(false);
    setSpinning(true);
  };

  const handleStopped = useCallback(() => {
    setStopped(true);
  }, []);

  const winner = DEMO_PARTICIPANTS[winnerIndex];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      <div className="relative w-full max-w-md max-h-[95dvh] flex flex-col animate-scale-in" style={{ animationFillMode: "forwards" }}>
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/40 via-pink-600/40 to-orange-500/40 rounded-[2rem] blur-2xl animate-pulse pointer-events-none" />

        <div className="relative glass rounded-3xl p-5 border border-purple-500/30 text-center overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <Icon name="FlaskConical" size={13} />
              ТЕСТ · Демо-режим
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>

          <h2 className="font-oswald text-2xl font-bold text-white mb-1">Тест колеса розыгрыша</h2>
          <p className="text-muted-foreground text-sm mb-4">{DEMO_PARTICIPANTS.length} участников · {duration} сек</p>

          {!spinning && !stopped && (
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1.5 block">Длительность вращения</label>
              <div className="flex items-center gap-3 justify-center">
                {[10, 15, 30, 60].map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${duration === d ? "grad-btn" : "bg-white/5 text-muted-foreground hover:text-white"}`}>
                    {d}с
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <DemoWheel
              participants={DEMO_PARTICIPANTS}
              spinning={spinning}
              winnerIndex={winnerIndex}
              startTime={startTime}
              duration={duration}
              onStopped={handleStopped}
            />
          </div>

          {!spinning && !stopped && (
            <button onClick={handleStart}
              className="grad-btn rounded-xl px-8 py-3 font-semibold text-sm flex items-center gap-2 mx-auto">
              <Icon name="Play" size={16} />
              Запустить колесо
            </button>
          )}

          {spinning && !stopped && (
            <div>
              <p className="text-muted-foreground text-sm mb-2">Победитель через</p>
              <p className="font-oswald text-5xl font-bold grad-text tabular-nums">{secsLeft}с</p>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-purple-300">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                Колесо крутится
              </div>
            </div>
          )}

          {stopped && (
            <div className="animate-scale-in">
              <div className="text-5xl mb-3">🏆</div>
              <p className="text-muted-foreground text-sm mb-1">Победитель</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl font-bold text-white">
                  {winner.name[0]}
                </div>
                <div>
                  <p className="font-oswald text-3xl font-bold text-white">{winner.name}</p>
                  <p className="text-yellow-400 text-sm font-semibold">Билет #{winner.ticket}</p>
                </div>
              </div>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={handleStart}
                  className="grad-btn rounded-xl px-6 py-2.5 font-semibold text-sm flex items-center gap-2">
                  <Icon name="RotateCcw" size={15} />
                  Ещё раз
                </button>
                <button onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-white/10 text-muted-foreground hover:text-white text-sm font-medium transition-colors">
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpinWheelDemo;
