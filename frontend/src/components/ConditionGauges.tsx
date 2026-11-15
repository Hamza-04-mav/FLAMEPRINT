"use client";

import { motion } from "framer-motion";
import { clamp, fmtGravity, toPsi } from "@/lib/format";
import { standardT } from "@/lib/motion";
import { useMission } from "@/lib/mission";
import type { Envelope, Range } from "@/lib/types";

/**
 * One visual grammar for every atmosphere axis (Norman: visual language over text):
 * a 0→max track, the NASA-tested span as a taupe segment, and the habitat as a
 * glowing yellow dot ("you are here" — a whitelisted sun role). When the dot sits
 * outside the taupe segment, the gap is the message: untested ≠ safe.
 */
function AxisGauge({ label, value, min, max, tested, valueText, size = "sm", note }: {
  label: string; value: number; min: number; max: number; tested: Range | null;
  valueText: string; size?: "lg" | "sm"; note?: string;
}) {
  const pos = (v: number) => clamp(((v - min) / (max - min)) * 100, 0, 100);
  const dot = pos(value);
  const t0 = tested ? pos(tested[0]) : 0;
  const t1 = tested ? pos(tested[1]) : 0;
  const outside = tested ? value < tested[0] - 0.01 || value > tested[1] + 0.01 : true;
  const h = size === "lg" ? "h-2.5" : "h-2";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`${size === "lg" ? "text-[13px]" : "text-[11px]"} text-dust-400`}>{label}</span>
        <span className={`font-mono tabular-nums text-dust-100 ${size === "lg" ? "text-[14px] font-semibold" : "text-[12px]"}`}>{valueText}</span>
      </div>
      <div className={`relative ${h} rounded-full`} style={{ background: "rgba(138,129,120,0.16)" }}>
        {tested && <motion.div className="absolute inset-y-0 origin-left rounded-full" style={{ left: `${t0}%`, width: `${Math.max(1.5, t1 - t0)}%`, background: "rgba(163,154,144,0.42)" }}
          initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={standardT} />}
        <motion.span aria-hidden className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: size === "lg" ? 15 : 12, height: size === "lg" ? 15 : 12, background: "var(--sun-500)", boxShadow: "0 0 0 1px var(--sun-ring), 0 0 16px 2px var(--sun-glow)" }}
          initial={false} animate={{ left: `${dot}%` }} transition={{ type: "spring", stiffness: 240, damping: 26 }} />
      </div>
      {(note || tested) && (
        <div className="mt-1 text-[10.5px] text-dust-500">
          {note ?? (tested ? `NASA tested ${trim(tested[0])}–${trim(tested[1])}${outside ? " · your point is outside it" : ""}` : "no tested range")}
        </div>
      )}
    </div>
  );
}

const trim = (v: number) => (+v.toFixed(1)).toString();

/** The hero readout: a large O₂ gauge plus matching mini gauges for pressure, airflow, gravity. */
export function ConditionReadout() {
  const { analysis, scenario } = useMission();
  const ranked = analysis?.ranked ?? [];
  const span = (pick: (e: Envelope) => Range | null | undefined): Range | null => {
    let lo = Infinity, hi = -Infinity;
    for (const r of ranked) { const rg = pick(r.envelope); if (rg) { lo = Math.min(lo, rg[0]); hi = Math.max(hi, rg[1]); } }
    return Number.isFinite(lo) ? [lo, hi] : null;
  };
  const o2 = span((e) => e.o2Pct);
  const pres = span((e) => e.pressureKpa);
  const flow = span((e) => e.flowCmS);
  const presPsi: Range | null = pres ? [toPsi(pres[0]), toPsi(pres[1])] : null;

  return (
    <div className="mt-6">
      <AxisGauge label="Oxygen the crew breathes" value={scenario.o2Pct} min={10} max={100} tested={o2} size="lg"
        valueText={`${Math.round(scenario.o2Pct)}%`} />
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
        <AxisGauge label="Pressure" value={toPsi(scenario.pressureKpa)} min={0} max={16} tested={presPsi}
          valueText={`${toPsi(scenario.pressureKpa)} psi`} />
        <AxisGauge label="Airflow felt" value={scenario.flowCmS} min={0} max={60} tested={flow}
          valueText={`${trim(scenario.flowCmS)} cm/s`} />
        <AxisGauge label="Gravity" value={scenario.gravityG} min={0} max={1} tested={null}
          valueText={`${fmtGravity(scenario.gravityG)} g`} note="PSI tested 0 g and 1 g only — nothing between" />
      </div>
    </div>
  );
}
