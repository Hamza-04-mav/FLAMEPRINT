"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AnswerScreen } from "@/components/AnswerScreen";
import { AskPanel } from "@/components/AskPanel";
import { Boot } from "@/components/Boot";
import { BriefPanel } from "@/components/BriefPanel";
import { CosmicBackdrop } from "@/components/CosmicBackdrop";
import { CompareHabitats } from "@/components/CompareHabitats";
import { DataLab } from "@/components/DataLab";
import { EarthPanel } from "@/components/EarthPanel";
import { Header } from "@/components/Header";
import { InvestigationDrawer } from "@/components/InvestigationDrawer";
import { MissionConfig } from "@/components/MissionConfig";
import { Ranking } from "@/components/Ranking";
import { Sidebar } from "@/components/Sidebar";
import { SpaceView } from "@/components/SpaceView";
import { StowageInspector } from "@/components/StowageInspector";
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
        <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
          {error && tab !== "answer" && <div className="mb-4"><ErrorNote message={error} onRetry={refreshData} /></div>}
          <AnimatePresence mode="wait">
            {ready && <motion.div key={tab}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}>
              {tab === "answer" && <AnswerScreen />}
              {tab === "stowage" && <StowageInspector />}
              {tab === "habitats" && <CompareHabitats />}
              {tab === "space" && <SpaceView />}
              {tab === "ranking" && <Ranking />}
              {tab === "brief" && <BriefPanel />}
              {tab === "genome" && <CompareHabitats initialMode="experiments" />}
              {tab === "earth" && <EarthPanel />}
              {tab === "ask" && <AskPanel />}
              {tab === "data" && <DataLab />}
            </motion.div>}
          </AnimatePresence>
          <footer className="mt-16 border-t border-[var(--line)] pt-5 text-[11.5px] leading-relaxed text-slate-500">
            FLAMEPRINT · NASA Space Apps 2026 · Independent project, not NASA-endorsed. Test values come only from imported NASA PSI
            files; anything marked approx, estimate, illustrative or modeled must be verified against PSI.
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
