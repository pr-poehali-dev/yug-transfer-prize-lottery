import Icon from "@/components/ui/icon";
import { Client } from "./adminTypes";

interface AdminClientsTabProps {
  clients: Client[];
  clientsTotal: number;
  clientsPage: number;
  clientsPages: number;
  clientsSearch: string;
  loadingClients: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
}

export function AdminClientsTab({
  clients, clientsTotal, clientsPage, clientsPages, clientsSearch,
  loadingClients, onSearchChange, onPageChange,
}: AdminClientsTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="font-oswald text-3xl font-bold text-white">Клиенты <span className="text-muted-foreground text-xl">({clientsTotal})</span></h2>
        <div className="relative">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={clientsSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Поиск по имени, @username..."
            className="bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-9 pr-4 py-2 text-white placeholder-muted-foreground text-sm outline-none w-64"
          />
        </div>
      </div>
      {loadingClients ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Icon name="Users" size={48} className="mx-auto mb-3 opacity-20" />
          <p>Клиентов пока нет</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {clients.map(c => (
              <div key={c.id} className="card-glow rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                  {c.photo_url ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" /> : (c.first_name[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-muted-foreground">{c.username ? `@${c.username}` : `TG: ${c.telegram_id}`} · {c.created_at.slice(0, 10)}</p>
                </div>
                <div className="hidden md:flex items-center gap-4 text-xs shrink-0">
                  <div className="text-center">
                    <p className="text-white font-semibold">{c.total_paid.toLocaleString("ru")} ₽</p>
                    <p className="text-muted-foreground">оплачено</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold">{c.payments_count}</p>
                    <p className="text-muted-foreground">платежей</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold">{c.entries_count}</p>
                    <p className="text-muted-foreground">участий</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold">{c.balance.toLocaleString("ru")} ₽</p>
                    <p className="text-muted-foreground">баланс</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {clientsPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={clientsPage <= 1} onClick={() => onPageChange(clientsPage - 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white disabled:opacity-30 text-sm transition-colors">
                <Icon name="ChevronLeft" size={16} />
              </button>
              <span className="text-sm text-muted-foreground">стр. {clientsPage} из {clientsPages}</span>
              <button disabled={clientsPage >= clientsPages} onClick={() => onPageChange(clientsPage + 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white disabled:opacity-30 text-sm transition-colors">
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
