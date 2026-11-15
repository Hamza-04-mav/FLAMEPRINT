"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useMission } from "@/lib/mission";
import { MobileNav, NAV } from "./Sidebar";

/**
 * Mobile primary nav: a bottom glass tab bar (Answer · Evidence · Gaps · Brief ·
 * Compare) with safe-area padding; Tools live behind "More". Hidden at md+ where the
 * icon rail takes over. Active tab is dust (yellow stays reserved for risk/CTA/marker).
 */
export function MobileTabBar() {
  const { tab, setTab } = useMission();
  const [more, setMore] = useState(false);
  const main = NAV.filter((n) => n.group === "main");
  const inTools = NAV.some((n) => n.group === "tools" && n.id === tab);
  return (
    <>
      <nav aria-label="Primary"
        className="panel-float fixed inset-x-0 bottom-0 z-40 flex items-stretch !rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
        {main.map((n) => {
          const active = tab === n.id || !!n.also?.includes(tab);
          return (
            <button key={n.id} onClick={() => setTab(n.id)} aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[9.5px] transition-colors ${active ? "text-dust-100" : "text-dust-500"}`}>
              <span className="grid h-5 place-items-center">{n.icon}</span>
              <span className="max-w-full truncate">{n.label}</span>
              {active && <span className="mt-0.5 h-0.5 w-5 rounded-full bg-dust-200" />}
            </button>
          );
        })}
        <button onClick={() => setMore(true)} aria-haspopup="menu"
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[9.5px] transition-colors ${inTools ? "text-dust-100" : "text-dust-500"}`}>
          <span className="grid h-5 place-items-center"><MoreHorizontal className="h-[18px] w-[18px]" /></span>
          <span>More</span>
          {inTools && <span className="mt-0.5 h-0.5 w-5 rounded-full bg-dust-200" />}
        </button>
      </nav>
      <MobileNav open={more} onClose={() => setMore(false)} />
    </>
  );
}
