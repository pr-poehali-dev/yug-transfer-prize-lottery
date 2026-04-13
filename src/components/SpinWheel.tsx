import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const SPIN_URL = "https://functions.poehali.dev/9eba717e-47b3-4a6b-add1-02c8a4a67974";
const POLL_INTERVAL = 3000;
const SPIN_DURATION = 30;

let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTick(vol = 0.12) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch { /* audio not available */ }
}

function playWinnerFanfare() {
  try {
    const ctx = getAudioCtx();
    const t0 = ctx.currentTime;
    const sequence = [
      { freq: 523, time: 0, dur: 0.2 },
      { freq: 659, time: 0.18, dur: 0.2 },
      { freq: 784, time: 0.36, dur: 0.25 },
      { freq: 1047, time: 0.55, dur: 0.6 },
      { freq: 784, time: 0.55, dur: 0.6 },
      { freq: 1319, time: 1.2, dur: 0.8 },
      { freq: 1047, time: 1.2, dur: 0.8 },
    ];
    sequence.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 3000;
      filter.Q.value = 2;
      const t = t0 + time;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.setValueAtTime(0.12, t + dur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    });
  } catch { /* audio not available */ }
}

interface Participant {
  id: number;
  name: string;
  photo: string;
  ticket: number;
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

const COLORS = [
  "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#6d28d9", "#be185d", "#0284c7",
  "#15803d", "#c2410c",
];

function WheelCanvas({
  participants,
  spinning,
  winnerIndex,
  startedAt,
  revealAt,
  onStopped,
}: {
  participants: Participant[];
  spinning: boolean;
  winnerIndex: number;
  startedAt: string;
  revealAt: string;
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

      const pointerPos = -Math.PI / 2;
      const normAngle = ((pointerPos - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const sectorUnderPointer = Math.floor(normAngle / slice) % n;

      participants.forEach((p, i) => {
        const start = angle + i * slice;
        const end = start + slice;
        const isWinner = highlightWinner && i === sectorUnderPointer;
        const isDimmed = highlightWinner && i !== sectorUnderPointer;

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
    [participants, n, slice]
  );

  useEffect(() => {
    if (!spinning) {
      draw(angleRef.current, stoppedRef.current);
      return;
    }

    stoppedRef.current = false;
    lastSectorRef.current = -1;
    const startTime = new Date(startedAt).getTime();
    const revealTime = new Date(revealAt).getTime();
    const totalDuration = Math.max(revealTime - startTime, SPIN_DURATION * 1000);

    const winAngle = -Math.PI / 2 - winnerIndex * slice - slice / 2;
    const totalRotations = 15 + Math.random() * 5;
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
        const vol = Math.max(0.04, Math.min(0.15, speed * 0.18));
        playTick(vol);
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
  }, [spinning, winnerIndex, startedAt, revealAt, draw, slice, onStopped]);

  useEffect(() => {
    if (!spinning) draw(angleRef.current, stoppedRef.current);
  }, [participants, spinning, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={380}
      height={380}
      className="rounded-full w-full max-w-[320px] h-auto"
      style={{ filter: "drop-shadow(0 0 40px rgba(168,85,247,0.5))" }}
    />
  );
}

export function SpinWheel() {
  const [spin, setSpin] = useState<Spin | null>(null);
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [wheelStopped, setWheelStopped] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(0);

  const secsLeft = useCountdown(spin?.reveal_at || new Date().toISOString());
  const audioInitRef = useRef(false);

  const initAudio = useCallback(() => {
    if (audioInitRef.current) return;
    audioInitRef.current = true;
    try {
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const handler = () => initAudio();
    document.addEventListener("click", handler, { once: true });
    document.addEventListener("touchstart", handler, { once: true });
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [initAudio]);

  const handleWheelStopped = useCallback(() => {
    setWheelStopped(true);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(SPIN_URL);
        const data = await res.json();
        if (!data.ok || !data.spin) { setSpin(null); setVisible(false); return; }

        const s: Spin = data.spin;
        const now = Date.now();
        const revealAt = new Date(s.reveal_at).getTime();

        if (now > revealAt + 120_000) { setSpin(null); setVisible(false); return; }

        setSpin(s);
        setVisible(true);

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
  const showWinnerInfo = revealed && wheelStopped;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      <div className="relative w-full max-w-md max-h-[95dvh] flex flex-col animate-scale-in" style={{ animationFillMode: "forwards" }}>
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/40 via-pink-600/40 to-orange-500/40 rounded-[2rem] blur-2xl animate-pulse pointer-events-none" />

        <div className="relative glass rounded-3xl p-5 border border-purple-500/30 text-center overflow-y-auto flex-1">
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wider mb-3 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              LIVE · Идёт розыгрыш
            </div>
            <h2 className="font-oswald text-2xl font-bold text-white">{spin.raffle_title}</h2>
            <p className="text-muted-foreground text-sm mt-1">{participants.length} участников</p>
          </div>

          <div className="flex justify-center mb-4">
            {participants.length > 1 ? (
              <WheelCanvas
                participants={participants}
                spinning={spinning}
                winnerIndex={winnerIndex}
                startedAt={spin.started_at}
                revealAt={spin.reveal_at}
                onStopped={handleWheelStopped}
              />
            ) : (
              <div className="w-full max-w-[280px] aspect-square rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mx-auto">
                <p className="text-white font-bold text-xl px-4 text-center">
                  #{participants[0]?.ticket} {participants[0]?.name || "—"}
                </p>
              </div>
            )}
          </div>

          {spinning ? (
            <div>
              <p className="text-muted-foreground text-sm mb-2">Победитель будет объявлен через</p>
              <p className="font-oswald text-5xl font-bold grad-text tabular-nums">{secsLeft}с</p>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-purple-300">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                Колесо крутится в реальном времени
              </div>
            </div>
          ) : showWinnerInfo ? (
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
                <div>
                  <p className="font-oswald text-3xl font-bold text-white">{spin.winner_name}</p>
                  <p className="text-yellow-400 text-sm font-semibold">
                    Билет #{participants[winnerIndex]?.ticket}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-bold">
                <Icon name="Trophy" size={16} />
                Поздравляем победителя!
              </div>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground text-sm mb-2">Колесо останавливается...</p>
              <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpinWheel;