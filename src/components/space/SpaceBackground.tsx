import { useMemo } from "react";

export const SPACE_BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/95ffefeb-bc16-4fb4-8928-92889e01b3ed.jpg";

export default function SpaceBackground({ dim = 0.6, count = 70, solid = 0 }: { dim?: number; count?: number; solid?: number }) {
  const stars = useMemo(
    () => Array.from({ length: count }, () => ({
      top: Math.random() * 100, left: Math.random() * 100,
      size: Math.random() * 2 + 1, delay: Math.random() * 4, dur: 2 + Math.random() * 3,
    })),
    [count],
  );
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#05060d] pointer-events-none">
      <style>{`
        @keyframes twinkle { 0%,100% { opacity: .2 } 50% { opacity: 1 } }
        @keyframes drift { from { transform: scale(1.05) translate(0,0) } to { transform: scale(1.15) translate(-2%,-1%) } }
      `}</style>
      <img src={SPACE_BG} alt="" className="absolute inset-0 w-full h-full object-cover object-left opacity-95"
        style={{ animation: "drift 40s ease-in-out infinite alternate" }} />
      <div className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at center, rgba(5,6,13,0.1) 0%, rgba(5,6,13,${dim}) 80%)` }} />
      {solid > 0 && <div className="absolute inset-0" style={{ background: `rgba(5,6,13,${solid})` }} />}
      {stars.map((s, i) => (
        <span key={i} className="absolute rounded-full bg-white"
          style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
      ))}
    </div>
  );
}
