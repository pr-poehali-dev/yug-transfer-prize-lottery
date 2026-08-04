import Icon from "@/components/ui/icon";
import { TARIFFS, TARIFF_ICONS, COUNTS, inputCls, Toggle, PayToggle, OrderFormState } from "./orderFormShared";

// МОБИЛЬНАЯ ВЕРСИЯ: нижняя шторка с панелями
const MobileOrderForm = ({ state }: { state: OrderFormState }) => {
  const {
    prefillFrom,
    prefillTo,
    prefillComment,
    formRef,
    tarifRef,
    tariff,
    panel,
    setPanel,
    pay,
    setPay,
    geoLoading,
    detectLocation,
    pickTariff,
  } = state;

  return (
    <div className="uc-tariffCalc absolute z-10 inset-x-0 bottom-0 max-h-[calc(100dvh-72px)] flex flex-col">
      <div className="bg-[#141414] rounded-t-[28px] md:rounded-[28px] border-t md:border border-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] flex flex-col max-h-[calc(100dvh-72px)] min-h-0">
        <form ref={formRef} className="flex flex-col min-h-0">
          {/* «ручка» шторки */}
          <div className="pt-2 pb-0.5 flex justify-center md:hidden">
            <span className="w-11 h-1.5 rounded-full bg-white/20" />
          </div>

          {/* Заголовок доп. панелей с кнопкой «Назад» */}
          {panel !== "main" && (
            <button
              type="button"
              onClick={() => setPanel("main")}
              className="flex items-center gap-2 px-6 pt-3 pb-1 text-white text-base font-semibold"
            >
              <Icon name="ArrowLeft" size={20} />
              Назад
            </button>
          )}

          {/* Прокручиваемая область с панелями (кнопки внизу остаются видимыми) */}
          <div className="flex-1 overflow-y-auto min-h-0">
          {/* ПАНЕЛЬ: ГЛАВНАЯ */}
          <div className={"px-5 pt-2 pb-1 space-y-2 " + (panel === "main" ? "" : "hidden")}>
            <div className="relative">
              <input name="place_start" defaultValue={prefillFrom} placeholder="Откуда?" autoComplete="off" className={inputCls + " pr-12"} />
              <button
                type="button"
                onClick={detectLocation}
                aria-label="Определить моё местоположение"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-amber-400 flex items-center justify-center hover:bg-amber-400/15 active:scale-95 transition"
              >
                <Icon name={geoLoading ? "LoaderCircle" : "LocateFixed"} size={16} className={"text-amber-400" + (geoLoading ? " animate-spin" : "")} />
              </button>
            </div>
            <input name="place_end" defaultValue={prefillTo} placeholder="Куда?" autoComplete="off" className={inputCls} />

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Дата поездки</label>
                <input name="Date" type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Во сколько?</label>
                <input name="Time" type="time" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <input name="name" placeholder="Ваше имя" className={inputCls} />
              <input name="Phone" placeholder="Номер телефона" type="tel" className={inputCls} />
            </div>

            {/* Скрытый select — его читает скрипт калькулятора */}
            <select ref={tarifRef} name="tarif" defaultValue={TARIFFS[0]} className="hidden" aria-hidden>
              {TARIFFS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <div className="no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1 pt-1">
              {TARIFFS.map((t) => {
                const active = tariff === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => pickTariff(t)}
                    className={
                      "calc__form__tarif__item shrink-0 w-[84px] flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 transition-colors " +
                      (active
                        ? "is-active border-amber-400 bg-amber-400/10"
                        : "border-white/10 bg-black/40 hover:border-amber-400/40")
                    }
                  >
                    <Icon
                      name={TARIFF_ICONS[t] || "Car"}
                      size={22}
                      className={active ? "text-amber-400" : "text-white/60"}
                    />
                    <span className={"calc__form__tarif__item__title text-xs font-medium leading-tight " + (active ? "text-white" : "text-white/70")}>
                      {t}
                    </span>
                    <span
                      ref={(el) => {
                        if (el && !el.textContent) el.textContent = "—";
                      }}
                      className={"calc__form__tarif__item__price text-[15px] font-extrabold leading-tight whitespace-nowrap " + (active ? "text-amber-400" : "text-white/70")}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ПАНЕЛЬ: ДОП. ОПЦИИ */}
          <div className={"px-6 pt-1 pb-2 " + (panel === "extra" ? "" : "hidden")}>
            <Toggle name="orderBabyChair" label="Детское кресло" />
            <div className="h-px bg-white/10" />
            <Toggle name="orderPet" label="С домашним животным" />
            <div className="h-px bg-white/10" />
            <Toggle name="orderBuster" label="Бустер" />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Количество человек</label>
                <select name="count_peeple" defaultValue="1" className={inputCls}>
                  {COUNTS.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Количество багажа</label>
                <select name="count_bags" defaultValue="1" className={inputCls}>
                  {["0", ...COUNTS].map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                </select>
              </div>
            </div>

            <textarea name="comment" defaultValue={prefillComment} placeholder="Комментарий водителю" rows={2} className={inputCls + " mt-2 resize-none"} />
          </div>

          {/* ПАНЕЛЬ: ОПЛАТА */}
          <div className={"px-6 pt-1 pb-2 " + (panel === "pay" ? "" : "hidden")}>
            <PayToggle label="Наличные" active={pay === "cash"} onClick={() => setPay("cash")} />
            <div className="h-px bg-white/10" />
            <PayToggle label="Перевод" active={pay === "transfer"} onClick={() => setPay("transfer")} />
            <div className="h-px bg-white/10" />
            <PayToggle label="По номеру счёта" active={pay === "account"} onClick={() => setPay("account")} />
          </div>
          </div>

          {/* Скрытые поля, которые читает скрипт */}
          <input type="hidden" name="order_price" defaultValue="" />
          <input type="checkbox" name="CardPayCash" className="hidden" aria-hidden readOnly />
          <input type="checkbox" name="CardPayTransfer" className="hidden" aria-hidden defaultChecked readOnly />
          <input type="checkbox" name="CardPayNubmerCard" className="hidden" aria-hidden readOnly />

          {/* Нижняя панель действий */}
          <div className="shrink-0 flex items-center gap-3 px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-5 border-t border-white/10 bg-[#141414]">
            <button
              type="button"
              onClick={() => setPanel(panel === "pay" ? "main" : "pay")}
              aria-label="Способ оплаты"
              className={"shrink-0 w-12 h-12 rounded-full flex items-center justify-center border transition-colors " + (panel === "pay" ? "border-amber-400 text-amber-400" : "border-amber-400/50 text-amber-400/80 hover:border-amber-400")}
            >
              <Icon name="Wallet" size={22} />
            </button>

            <button
              type="submit"
              className="flex-1 h-12 flex items-center justify-center text-lg font-bold rounded-full bg-[#d1d13a] hover:bg-[#dede4a] text-black transition-colors"
            >
              Отправить
            </button>

            <button
              type="button"
              onClick={() => setPanel(panel === "extra" ? "main" : "extra")}
              aria-label="Дополнительно"
              className={"shrink-0 w-12 h-12 rounded-full flex items-center justify-center border transition-colors " + (panel === "extra" ? "border-amber-400 text-amber-400" : "border-amber-400/50 text-amber-400/80 hover:border-amber-400")}
            >
              <Icon name="SlidersHorizontal" size={22} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MobileOrderForm;