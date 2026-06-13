import { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";
import ContactWidget from "@/components/ContactWidget";
import Icon from "@/components/ui/icon";

const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ea8c632-dfa9-4e5c-8051-74474ecd91aa.jpg";

interface Props {
  title: string;
  icon: string;
  children: ReactNode;
}

export default function PageShell({ title, icon, children }: Props) {
  return (
    <div className="min-h-screen bg-cover bg-center bg-fixed relative" style={{ backgroundImage: `url(${BG})` }}>
      <div className="absolute inset-0 bg-black/70" />
      <SiteHeader />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center">
            <Icon name={icon} size={22} className="text-black" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
        </div>
        {children}
      </div>
      <ContactWidget />
    </div>
  );
}