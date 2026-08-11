import Icon from "@/components/ui/icon";

interface PostTelegramPreviewProps {
  title?: string;
  text: string;
  photo_url: string;
  button_text: string;
  button_url: string;
  button2_text?: string;
  button2_url?: string;
}

const TIME = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

const buildTextWithTitle = (title: string, text: string): string => {
  const t = (title || "").trim();
  if (!t) return text || "";
  const plain = (text || "").replace(/^\s+/, "");
  if (plain.startsWith(t) || plain.startsWith(`<b>${t}</b>`)) return text || "";
  return text && text.trim() ? `<b>${t}</b>\n\n${text}` : `<b>${t}</b>`;
};

export function PostTelegramPreview({ title = "", text, photo_url, button_text, button_url, button2_text = "", button2_url = "" }: PostTelegramPreviewProps) {
  const fullText = buildTextWithTitle(title, text);
  if (!fullText && !photo_url) return null;

  return (
    <div className="rounded-2xl bg-[#17212b] border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
        <div className="w-2 h-2 rounded-full bg-[#2ea6ff]" />
        <p className="text-xs text-[#2ea6ff] font-medium">Предпросмотр · Telegram</p>
      </div>
      <div className="p-3 space-y-2">

        {/* Текст + фото + кнопка */}
        {(fullText || photo_url) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm overflow-hidden bg-[#182533]">
              {photo_url && (
                <img src={photo_url} alt="" className="w-full max-h-48 object-cover" />
              )}
              {fullText && (
                <div className="px-3 py-2">
                  <div
                    className="text-[#e8e8e8] text-sm leading-relaxed break-words [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_a]:text-[#2ea6ff] [&_a]:underline"
                    dangerouslySetInnerHTML={{
                      __html: fullText
                        .replace(/\n/g, "<br/>")
                        .replace(/<(?!\/?(?:b|i|a|br)\b)[^>]+>/gi, ""),
                    }}
                  />
                  <p className="text-[#6c8998] text-[10px] text-right mt-1">{TIME}</p>
                </div>
              )}
              {(button_text && button_url) || (button2_text && button2_url) ? (
                <div className="border-t border-white/5 px-3 py-1.5 flex gap-1">
                  {button_text && button_url && (
                    <div className="flex-1 flex items-center justify-center gap-1.5 text-[#2ea6ff] text-sm font-medium py-1">
                      <Icon name="ExternalLink" size={13} />
                      {button_text}
                    </div>
                  )}
                  {button_text && button_url && button2_text && button2_url && (
                    <div className="w-px bg-white/10 self-stretch" />
                  )}
                  {button2_text && button2_url && (
                    <div className="flex-1 flex items-center justify-center gap-1.5 text-[#2ea6ff] text-sm font-medium py-1">
                      <Icon name="ExternalLink" size={13} />
                      {button2_text}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default PostTelegramPreview;