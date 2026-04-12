import Icon from "@/components/ui/icon";
import { Raffle } from "@/components/raffle-types";

export function WinnersSection({ raffles }: { raffles: Raffle[] }) {
  const winners = raffles.filter(r => r.status === "ended" && r.winner);
  if (winners.length === 0) return null;

  return (
    <div className="mt-14">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-base">🏆</div>
        <div>
          <h2 className="font-oswald text-2xl font-bold text-white">Наши победители</h2>
          <p className="text-xs text-muted-foreground">Реальные люди, реальные призы</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {winners.map((r, i) => (
          <div
            key={r.id}
            className="glass rounded-2xl p-4 flex items-center gap-4 opacity-0-init animate-fade-in-up border border-white/5"
            style={{ animationDelay: `${i * 0.07}s`, animationFillMode: "forwards" }}
          >
            {r.photoUrl ? (
              <img src={r.photoUrl} alt={r.title} className="w-14 h-14 rounded-xl object-cover shrink-0" />
            ) : (
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center text-2xl shrink-0`}>
                <Icon name={r.prizeIcon as string} size={24} className="text-white" fallback="Gift" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5 truncate">{r.title}</p>
              <p className={`text-sm font-semibold bg-gradient-to-r ${r.gradient} bg-clip-text text-transparent truncate`}>
                🏆 {r.prize}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Icon name="User" size={11} className="text-white" />
                </div>
                <span className="text-sm text-white font-medium truncate">{r.winner}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
