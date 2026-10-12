interface Props {
  username: string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function TgLink({ username, className = "text-sky-300", prefix = "@", suffix = "" }: Props) {
  const u = username.replace(/^@/, "");
  return (
    <a
      href={`https://t.me/${u}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Открыть в Telegram"
      className={`${className} hover:underline`}
    >
      {prefix}{u}{suffix}
    </a>
  );
}

export default TgLink;
