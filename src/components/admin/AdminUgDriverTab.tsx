import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { UG_DRIVER_PARSER_URL, TG_USER_AUTH3_URL } from "./adminTypes";
import { TgUserLogin } from "./TgUserLogin";

interface Props { token: string; }

interface Stats {
  total: number;
  with_username: number;
  with_phone?: number;
  bots: number;
  last_run: {
    id: number;
    started_at: string | null;
    finished_at: string | null;
    status: string;
    total_fetched: number;
    new_members: number;
    updated_members: number;
    error: string | null;
  } | null;
}

interface Member {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_bot: boolean;
  is_premium: boolean;
  status: string;
  source_group?: string;
  phone?: string;
  last_parsed_at: string | null;
}

export function AdminUgDriverTab({ token }: Props) {
  const [tabExpanded, setTabExpanded] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [parseMsg, setParseMsg] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [resolvingPhones, setResolvingPhones] = useState(false);
  const [phonesMsg, setPhonesMsg] = useState("");
  const PAGE_SIZE = 50;

  const headers = { "X-Admin-Token": token };

  const loadStats = async () => {
    const r = await fetch(UG_DRIVER_PARSER_URL, { headers });
    const d = await r.json();
    setStats(d);
  };

  const loadMembers = async (q = search, p = page) => {
    const url = `${UG_DRIVER_PARSER_URL}?action=list&limit=${PAGE_SIZE}&offset=${p * PAGE_SIZE}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers });
    const d = await r.json();
    setMembers(d.items || []);
    setMemberTotal(d.total || 0);
  };

  useEffect(() => {
    if (tabExpanded) {
      loadStats();
      loadMembers("", 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabExpanded]);

  const runResolvePhones = async () => {
    setResolvingPhones(true);
    let totalProcessed = 0;
    let totalFound = 0;
    try {
      for (let i = 0; i < 200; i++) {
        setPhonesMsg(`Подтягиваем телефоны · чанк ${i + 1}...`);
        const r = await fetch(`${UG_DRIVER_PARSER_URL}?action=resolve_phones`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
        });
        const d = await r.json();
        if (!d.ok && d.error) {
          setPhonesMsg(`Телефоны: остановка · ${d.error}`);
          break;
        }
        totalProcessed += d.processed || 0;
        totalFound += d.phones_found || 0;
        setPhonesMsg(`Телефоны: обработано ${totalProcessed}, найдено ${totalFound}${d.finished ? " · готово" : "..."}`);
        await loadStats();
        if (d.finished) break;
        await new Promise(res => setTimeout(res, 1500));
      }
      await loadMembers(search, page);
    } catch (e) {
      setPhonesMsg(`Телефоны: ошибка сети · ${(e as Error).message}`);
    } finally {
      setResolvingPhones(false);
    }
  };

  const startParse = async () => {
    if (parsing || resolvingPhones) return;
    const groupLabel = groupInput.trim() || "@UG_DRIVER";
    if (!confirm(`Запустить парсинг ${groupLabel}?\n\nСначала соберём участников (до 3 мин), затем подтянем телефоны (5-15 мин).`)) return;
    setParsing(true);
    let totalFetched = 0;
    let totalNew = 0;
    let totalUpd = 0;
    let action = "parse";
    let parsedOk = false;
    try {
      for (let i = 0; i < 60; i++) {
        setParseMsg(`Чанк ${i + 1}: парсим ${groupLabel}...`);
        const r = await fetch(`${UG_DRIVER_PARSER_URL}?action=${action}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ group: groupInput.trim() }),
        });
        const d = await r.json();
        if (!d.ok && d.error) {
          setParseMsg(`Ошибка: ${d.error}`);
          break;
        }
        totalFetched += d.total_fetched || 0;
        totalNew += d.new_members || 0;
        totalUpd += d.updated_members || 0;
        const pct = Math.round(((d.pos || 0) / (d.total_stages || d.total_letters || 1)) * 100);
        const stageLabel = d.stage === "recent" ? " · Recent" : d.stage === "msg_scan" ? " · Сканируем сообщения" : d.stage === "done" ? " · Финал" : "";
        setParseMsg(`Прогресс: ${pct}%${stageLabel} · загружено ${totalFetched}, новых ${totalNew}, обновлено ${totalUpd}`);
        await loadStats();
        if (d.finished) {
          setParseMsg(`Парсинг готов: ${groupLabel} · всего ${totalFetched}, новых ${totalNew}, обновлено ${totalUpd}`);
          parsedOk = true;
          break;
        }
        action = "parse_continue";
        await new Promise(res => setTimeout(res, 800));
      }
      await loadMembers("", 0);
      setPage(0);
      setSearch("");
    } catch (e) {
      setParseMsg(`Ошибка сети: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
    if (parsedOk) {
      await runResolvePhones();
    }
  };

  const resolvePhones = async () => {
    if (resolvingPhones || parsing) return;
    if (!confirm("Подтянуть телефоны через Telegram-аккаунт парсера?\n\nTelegram отдаёт номер только тем, у кого открыта приватность. Обычно 5-30% от общего числа. Может занять 5-15 минут.")) return;
    let totalProcessed = 0;
    let totalFound = 0;
    setResolvingPhones(true);
    try {
      for (let i = 0; i < 200; i++) {
        setPhonesMsg(`Чанк ${i + 1}: проверяем 50 юзеров...`);
        const r = await fetch(`${UG_DRIVER_PARSER_URL}?action=resolve_phones`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
        });
        const d = await r.json();
        if (!d.ok && d.error) {
          setPhonesMsg(`Остановка: ${d.error}`);
          break;
        }
        totalProcessed += d.processed || 0;
        totalFound += d.phones_found || 0;
        setPhonesMsg(`Обработано ${totalProcessed}, найдено телефонов ${totalFound}${d.finished ? " · готово" : "..."}`);
        await loadStats();
        if (d.finished) break;
        await new Promise(res => setTimeout(res, 1500));
      }
      await loadMembers(search, page);
    } catch (e) {
      setPhonesMsg(`Ошибка сети: ${(e as Error).message}`);
    } finally {
      setResolvingPhones(false);
    }
  };

  const onSearchChange = (v: string) => {
    setSearch(v);
    setPage(0);
    loadMembers(v, 0);
  };

  const goPage = (p: number) => {
    setPage(p);
    loadMembers(search, p);
  };

  const totalPages = Math.max(1, Math.ceil(memberTotal / PAGE_SIZE));

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setTabExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="Users" size={15} className="text-cyan-400" />
          <span className="text-sm font-medium text-white">Парсер участников @UG_DRIVER</span>
          {stats && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
              {stats.total.toLocaleString("ru-RU")} в БД
            </span>
          )}
        </div>
        <Icon name="ChevronDown" size={16} className={`text-white/50 transition-transform ${tabExpanded ? "rotate-180" : ""}`} />
      </button>

      {tabExpanded && (
        <div className="p-4 space-y-4">
          <TgUserLogin
            token={token}
            authUrl={TG_USER_AUTH3_URL}
            title="Telegram-аккаунт для парсинга"
            hint="Войди отдельным номером — этот аккаунт будет использоваться только для сбора участников. Должен быть в группах, которые парсишь."
          />

          <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Icon name="Database" size={20} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-lg">Статистика</h3>
                <p className="text-white/40 text-xs">Используется второй Telegram-аккаунт (он должен быть в группе)</p>
              </div>
            </div>

            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl bg-white/3 border border-white/5 p-3">
                  <div className="text-2xl font-bold text-white">{stats.total.toLocaleString("ru-RU")}</div>
                  <div className="text-[11px] text-white/40">всего в БД</div>
                </div>
                <div className="rounded-xl bg-white/3 border border-white/5 p-3">
                  <div className="text-2xl font-bold text-emerald-300">{stats.with_username.toLocaleString("ru-RU")}</div>
                  <div className="text-[11px] text-white/40">с @username</div>
                </div>
                <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-3">
                  <div className="text-2xl font-bold text-green-300">{(stats.with_phone ?? 0).toLocaleString("ru-RU")}</div>
                  <div className="text-[11px] text-white/40">с телефоном</div>
                </div>
                <div className="rounded-xl bg-white/3 border border-white/5 p-3">
                  <div className="text-2xl font-bold text-amber-300">{stats.bots}</div>
                  <div className="text-[11px] text-white/40">ботов</div>
                </div>
              </div>
            )}

            {stats?.last_run && (
              <div className="text-[11px] text-white/50 mb-3">
                Последний парсинг: {stats.last_run.finished_at ? new Date(stats.last_run.finished_at).toLocaleString("ru-RU") : "в процессе"}
                {stats.last_run.status === "success" && ` · загружено ${stats.last_run.total_fetched}, новых ${stats.last_run.new_members}`}
                {stats.last_run.status === "failed" && stats.last_run.error && (
                  <span className="text-red-300"> · ошибка: {stats.last_run.error}</span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="relative">
                <Icon name="Link" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  value={groupInput}
                  onChange={e => setGroupInput(e.target.value)}
                  placeholder="@username группы или https://t.me/... (пусто = @UG_DRIVER)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-cyan-500/50"
                />
              </div>
              <p className="text-[11px] text-white/40">
                Твой второй Telegram-аккаунт должен быть участником этой группы. Приватные ссылки t.me/+... работают если ты уже состоишь в группе.
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={startParse}
                  disabled={parsing || resolvingPhones}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Icon name={parsing ? "Loader2" : "Download"} size={14} className={parsing ? "animate-spin" : ""} />
                  {parsing ? "Парсинг..." : "Запустить парсинг"}
                </button>
                <button
                  onClick={resolvePhones}
                  disabled={parsing || resolvingPhones}
                  className="px-4 py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-300 text-sm font-medium hover:bg-green-500/25 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Icon name={resolvingPhones ? "Loader2" : "Phone"} size={14} className={resolvingPhones ? "animate-spin" : ""} />
                  {resolvingPhones ? "Подтягиваем..." : "Подтянуть телефоны"}
                </button>
                {parseMsg && <span className="text-xs text-white/60 w-full">{parseMsg}</span>}
                {phonesMsg && <span className="text-xs text-green-300/70 w-full">{phonesMsg}</span>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Icon name="Users" size={20} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-lg">Участники</h3>
                <p className="text-white/40 text-xs">{memberTotal.toLocaleString("ru-RU")} записей</p>
              </div>
            </div>

            <div className="relative mb-3">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Поиск по username, имени или ID"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-cyan-500/50"
              />
            </div>

            {members.length === 0 ? (
              <p className="text-white/30 text-center py-6 text-sm">
                {memberTotal === 0 ? "В базе пока нет участников — запусти парсинг" : "Никого не найдено"}
              </p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                  {members.map(m => {
                    const isExcluded = m.status === "excluded";
                    return (
                    <div key={m.user_id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${isExcluded ? "bg-red-500/5 border-red-500/20" : "bg-white/3 border-white/5"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 ${isExcluded ? "bg-gradient-to-br from-red-500/40 to-orange-500/40" : "bg-gradient-to-br from-purple-500/30 to-cyan-500/30"}`}>
                        {(m.first_name || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-white truncate">
                            {m.first_name} {m.last_name}
                          </span>
                          {m.username && (
                            <a href={`https://t.me/${m.username}`} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-300 hover:underline">
                              @{m.username}
                            </a>
                          )}
                          {m.phone && (
                            <a href={`tel:+${m.phone.replace(/[^0-9]/g, "")}`} className="text-[11px] text-green-300 hover:underline inline-flex items-center gap-1">
                              <Icon name="Phone" size={10} />+{m.phone.replace(/[^0-9]/g, "")}
                            </a>
                          )}
                          {isExcluded && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/25 text-red-200 inline-flex items-center gap-1"><Icon name="UserX" size={9} />ИСКЛЮЧЁН</span>}
                          {m.is_bot && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">BOT</span>}
                          {m.is_premium && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">PREMIUM</span>}
                        </div>
                        <div className="text-[10px] text-white/40">
                          ID: {m.user_id}
                          {m.source_group && <span className="ml-2">· {m.source_group}</span>}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={() => goPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 disabled:opacity-30"
                    >
                      <Icon name="ChevronLeft" size={12} />
                    </button>
                    <span className="text-xs text-white/50">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => goPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 disabled:opacity-30"
                    >
                      <Icon name="ChevronRight" size={12} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUgDriverTab;