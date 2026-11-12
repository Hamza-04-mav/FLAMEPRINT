"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AskPanel } from "@/components/AskPanel";
import { Boot } from "@/components/Boot";
import { BriefPanel } from "@/components/BriefPanel";
import { CosmicBackdrop } from "@/components/CosmicBackdrop";
import { DataLab } from "@/components/DataLab";
import { EarthPanel } from "@/components/EarthPanel";
import { Genome } from "@/components/Genome";
import { Header } from "@/components/Header";
import { InvestigationDrawer } from "@/components/InvestigationDrawer";
import { MissionConfig } from "@/components/MissionConfig";
import { Overview } from "@/components/Overview";
import { Ranking } from "@/components/Ranking";
import { Sidebar } from "@/components/Sidebar";
import { SpaceView } from "@/components/SpaceView";
import { ErrorNote } from "@/components/ui";
import { MissionProvider, useMission } from "@/lib/mission";

function Dashboard() {
  const { tab, error, refreshData, ready } = useMission();
  return (
    <>
      <CosmicBackdrop />
      <Sidebar />
      <div className="relative z-10 lg:pl-[76px] xl:pl-[252px]">
        <Header />
        <main className="mx-auto max-w-[1720px] px-3 pb-16 pt-5 sm:px-6 sm:pt-6">
          {error && <div className="mb-4"><ErrorNote message={error} onRetry={refreshData} /></div>}
          <AnimatePresence mode="wait">
            {ready && <motion.div key={tab}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}>
              {tab === "overview" && <Overview />}
              {tab === "space" && <SpaceView />}
              {tab === "ranking" && <Ranking />}
              {tab === "brief" && <BriefPanel />}
              {tab === "genome" && <Genome />}
              {tab === "earth" && <EarthPanel />}
              {tab === "ask" && <AskPanel />}
              {tab === "data" && <DataLab />}
            </motion.div>}
          </AnimatePresence>
          <footer className="mt-14 flex flex-wrap items-start justify-between gap-x-8 gap-y-2 border-t border-[var(--line)] pt-5 text-[11.5px] leading-relaxed text-slate-500">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">FLAMEPRINT · NASA Space Apps 2026 · Flame in Freefall</span>
            <span className="max-w-3xl">Investigation metadata is curated from the challenge brief and public NASA summaries. Test-level values appear only
              from imported NASA PSI files. Anything marked approx, estimate or illustrative must be verified against PSI.</span>
          </footer>
        </main>
      </div>
      <MissionConfig />
      <InvestigationDrawer />
    </>
  );
}

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <MissionProvider>
        <Boot />
        <Dashboard />
      </MissionProvider>
    </MotionConfig>
  );
}
