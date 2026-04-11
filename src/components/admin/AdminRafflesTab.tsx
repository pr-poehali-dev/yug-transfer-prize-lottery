import Icon from "@/components/ui/icon";
import { RaffleDB } from "./adminTypes";

interface AdminRafflesTabProps {
  raffles: RaffleDB[];
  loadingRaffles: boolean;
  finishing: number | null;
  deleting: number | null;
  onAdd: () => void;
  onEdit: (r: RaffleDB) => void;
  onFinish: (r: RaffleDB) => void;
  onDelete: (id: number) => void;
}

const statusLabel: Record<string, string> = { active: "Активен", upcoming: "Скоро", ended: "Завершён" };
const statusCls: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  upcoming: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  ended: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function AdminRafflesTab({ raffles, loadingRaffles, finishing, deleting, onAdd, onEdit, onFinish, onDelete }: AdminRafflesTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-oswald text-3xl font-bold text-white">Розыгрыши</h2>
        <button onClick={onAdd} className="grad-btn rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
          <Icon name="Plus" size={15} />Добавить
        </button>
      </div>

      {loadingRaffles ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : raffles.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Icon name="Gift" size={48} className="mx-auto mb-3 opacity-20" />
          <p className="mb-4">Розыгрышей пока нет</p>
          <button onClick={onAdd} className="grad-btn rounded-xl px-6 py-2.5 text-sm font-semibold">
            Создать первый
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {raffles.map(r => (
            <div key={r.id} className="card-glow rounded-2xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center shrink-0`}>
                <Icon name={r.prize_icon as string} size={18} className="text-white" fallback="Gift" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.prize} · до {r.end_date} · {r.min_amount} ₽</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCls[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
                {r.status === "active" && (
                  <button onClick={() => onFinish(r)} disabled={finishing === r.id}
                    className="h-8 px-2.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 flex items-center gap-1.5 text-orange-400 transition-colors disabled:opacity-40 text-xs font-medium">
                    {finishing === r.id
                      ? <div className="w-3 h-3 border border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                      : <Icon name="FlagTriangleRight" size={13} />}
                    Завершить
                  </button>
                )}
                <button onClick={() => onEdit(r)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                  <Icon name="Pencil" size={14} />
                </button>
                <button onClick={() => onDelete(r.id)} disabled={deleting === r.id}
                  className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-colors disabled:opacity-40">
                  {deleting === r.id
                    ? <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    : <Icon name="Trash2" size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
