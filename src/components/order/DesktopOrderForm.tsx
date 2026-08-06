import Icon from "@/components/ui/icon";
import { TARIFFS, TARIFF_ICONS, COUNTS, inputCls, PhoneInput, OrderFormState } from "./orderFormShared";

// ДЕСКТОПНАЯ ВЕРСИЯ: прежняя форма «Оставить заявку»
const DesktopOrderForm = ({ state }: { state: OrderFormState }) => {
  const {
    prefillFrom,
    prefillTo,
    prefillComment,
    formRef,
    tarifRef,
    tariff,
    geoLoading,
    detectLocation,
    pickTariff,
  } = state;

  return (
    <div className="relative z-10 w-full max-w-lg px-5 pt-3 pb-0 h-auto overflow-visible block absolute -bottom-2 left-0">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-white">Мой Трансфер</h1>
      </div>
      <div className="uc-tariffCalc bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl p-5 block">
        <form ref={formRef} className="block">
          <h2 className="text-lg font-bold text-amber-400 text-center mb-2">Оставить заявку</h2>
          <div className="space-y-2">
            <div className="relative">
              <input name="place_start" defaultValue={prefillFrom} placeholder="Откуда вас забрать?" autoComplete="off" className={inputCls + " pr-11"} />
              <button
                type="button"
                onClick={detectLocation}
                aria-label="Определить моё местоположение"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-amber-400 flex items-center justify-center hover:bg-amber-400/15 active:scale-95 transition"
              >
                <Icon name={geoLoading ? "LoaderCircle" : "LocateFixed"} size={15} className={"text-amber-400" + (geoLoading ? " animate-spin" : "")} />
              </button>
            </div>
            <input name="place_end" defaultValue={prefillTo} placeholder="Куда довезти?" autoComplete="off" className={inputCls} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/80 text-xs font-medium mb-1">Дата поездки</label>
                <input name="Date" type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/80 text-xs font-medium mb-1">Время</label>
                <input name="Time" type="time" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 text-xs font-medium mb-1">Кол-во человек</label>
                <select name="count_peeple" defaultValue="1" className={inputCls}>
                  {COUNTS.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-xs font-medium mb-1">Кол-во багажа</label>
                <select name="count_bags" defaultValue="1" className={inputCls}>
                  {["0", ...COUNTS].map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                </select>
              </div>
            </div>

            <select ref={tarifRef} name="tarif" defaultValue={TARIFFS[0]} className="hidden" aria-hidden>
              {TARIFFS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <div>
              <label className="block text-white/80 text-xs font-medium mb-1">Выберите класс авто</label>
              <div className="no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                {TARIFFS.map((t) => {
                  const active = tariff === t;
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => pickTariff(t)}
                      className={
                        "calc__form__tarif__item shrink-0 w-[76px] flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 transition-colors " +
                        (active
                          ? "is-active border-amber-500 bg-amber-500/15"
                          : "border-white/10 bg-black/30 hover:border-amber-500/40")
                      }
                    >
                      <Icon
                        name={TARIFF_ICONS[t] || "Car"}
                        size={20}
                        className={active ? "text-amber-400" : "text-white/70"}
                      />
                      <span className={"calc__form__tarif__item__title text-[10px] leading-tight " + (active ? "text-white" : "text-white/70")}>
                        {t}
                      </span>
                      <span
                        ref={(el) => {
                          if (el && !el.textContent) el.textContent = "—";
                        }}
                        className="calc__form__tarif__item__price text-sm font-extrabold leading-tight whitespace-nowrap text-amber-400"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-2">
              <label className="flex items-center gap-1.5 text-white/90 text-sm cursor-pointer whitespace-nowrap">
                <input type="checkbox" name="orderBabyChair" className="w-4 h-4 accent-amber-500 shrink-0" />
                Дет. кресло
              </label>
              <label className="flex items-center gap-1.5 text-white/90 text-sm cursor-pointer whitespace-nowrap">
                <input type="checkbox" name="orderBuster" className="w-4 h-4 accent-amber-500 shrink-0" />
                Бустер
              </label>
              <label className="flex items-center gap-1.5 text-white/90 text-sm cursor-pointer whitespace-nowrap">
                <input type="checkbox" name="orderPet" className="w-4 h-4 accent-amber-500 shrink-0" />
                Животные
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input name="name" placeholder="Как вас зовут" className={inputCls} />
              <PhoneInput className={inputCls} />
            </div>

            <textarea name="comment" defaultValue={prefillComment} placeholder="Комментарий (необязательно)" rows={2} className={inputCls} />

            <input type="hidden" name="order_price" defaultValue="" />
            <input type="checkbox" name="CardPayCash" defaultChecked className="hidden" aria-hidden />

            <button
              type="submit"
              className="w-full mt-3 h-14 min-h-14 max-h-14 shrink-0 flex items-center justify-center gap-2 leading-none text-lg font-bold rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-colors [&_img]:h-6 [&_img]:w-6 [&_svg]:h-6 [&_svg]:w-6 overflow-hidden"
            >
              Заказать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DesktopOrderForm;