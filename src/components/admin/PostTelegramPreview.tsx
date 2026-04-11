import Icon from "@/components/ui/icon";

interface PostTelegramPreviewProps {
  text: string;
  photo_url: string;
  button_text: string;
  button_url: string;
}

export function PostTelegramPreview({ text, photo_url, button_text, button_url }: PostTelegramPreviewProps) {
  if (!text && !photo_url) return null;

  return (
    <div className="rounded-2xl bg-[#17212b] border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
        <div className="w-2 h-2 rounded-full bg-[#2ea6ff]" />
        <p className="text-xs text-[#2ea6ff] font-medium">Предпросмотр · Telegram</p>
      </div>
      <div className="p-3">
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
                <p className="text-[#6c8998] text-[10px] text-right mt-1">
                  {new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                </p>
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
      </div>
    </div>
  );
}

export default PostTelegramPreview;
