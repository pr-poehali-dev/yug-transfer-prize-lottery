import Icon from "@/components/ui/icon";

interface PostTelegramPreviewProps {
  text: string;
  photo_url: string;
  video_note_url: string;
  button_text: string;
  button_url: string;
}

const TIME = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

export function PostTelegramPreview({ text, photo_url, video_note_url, button_text, button_url }: PostTelegramPreviewProps) {
  if (!text && !photo_url && !video_note_url) return null;

  return (
    <div className="rounded-2xl bg-[#17212b] border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
        <div className="w-2 h-2 rounded-full bg-[#2ea6ff]" />
        <p className="text-xs text-[#2ea6ff] font-medium">Предпросмотр · Telegram</p>
      </div>
      <div className="p-3 space-y-2">

        {/* Видео-кружок */}
        {video_note_url && (
          <div className="flex justify-start">
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-[#2ea6ff]/30 bg-black">
                <video
                  src={video_note_url}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
              <div className="absolute bottom-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                <Icon name="Play" size={8} className="text-white fill-white" />
                <span className="text-[9px] text-white">0:00</span>
              </div>
              <p className="text-[#6c8998] text-[10px] text-right mt-0.5">{TIME}</p>
            </div>
          </div>
        )}

        {/* Текст + фото + кнопка */}
        {(text || photo_url) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm overflow-hidden bg-[#182533]">
              {photo_url && (
                <img src={photo_url} alt="" className="w-full max-h-48 object-cover" />
              )}
              {text && (
                <div className="px-3 py-2">
                  <div
                    className="text-[#e8e8e8] text-sm leading-relaxed break-words"
                    dangerouslySetInnerHTML={{
                      __html: text
                        .replace(/\n/g, "<br/>")
                        .replace(/<(?!b|\/b|i|\/i|a|\/a|br)[^>]+>/gi, ""),
                    }}
                  />
                  <p className="text-[#6c8998] text-[10px] text-right mt-1">{TIME}</p>
                </div>
              )}
              {button_text && button_url && (
                <div className="border-t border-white/5 px-3 py-2">
                  <div className="flex items-center justify-center gap-1.5 text-[#2ea6ff] text-sm font-medium">
                    <Icon name="ExternalLink" size={13} />
                    {button_text}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Кнопка без текста (если только кружок + кнопка) */}
        {video_note_url && !text && !photo_url && button_text && button_url && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm overflow-hidden bg-[#182533] border-t border-white/5 px-4 py-2">
              <div className="flex items-center justify-center gap-1.5 text-[#2ea6ff] text-sm font-medium">
                <Icon name="ExternalLink" size={13} />
                {button_text}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default PostTelegramPreview;