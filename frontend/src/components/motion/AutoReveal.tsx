"use client";

import { useEffect } from "react";
import { formatLike, parseCountable } from "@/lib/countup";
import { COUNT, REVEAL, TYPE } from "@/lib/motion";

/**
 * One motion layer for the whole site, applied without touching the components it animates.
 * Inside <main>, every panel, card and list row reveals once (fade + rise, sibling stagger), panels draw thin corner
 * brackets, `.rule`/`hr` hairlines draw in, grade stamps settle, and pure numbers count up from zero to their exact
 * original text. State lives in `data-fp` attributes that React never writes, so a re-render can't fight it, and
 * nothing is hidden unless this script runs. Off entirely with prefers-reduced-motion.
 */
const TARGETS = [
  ".panel", "[data-reveal]", "main ol > li", "main ul > li", "main table > tbody > tr",
].join(",");
const SKIP = "nav, [role=listbox], [role=menu], [data-no-reveal], .panel-float, header, footer, svg";
const COUNT_SKIP = "button, a, input, select, option, textarea, svg, [aria-hidden=true], [data-no-count]";

function countUp(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const items: { n: Text; p: NonNullable<ReturnType<typeof parseCountable>>; full: string; lead: string; trail: string; last: string }[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    const host = n.parentElement;
    if (!host || host.closest(COUNT_SKIP) || host.closest("[data-fp-counted]")) continue;
    const full = n.nodeValue ?? "";
    const p = parseCountable(full);
    if (p) items.push({ n, p, full, lead: full.match(/^\s*/)![0], trail: full.match(/\s*$/)![0], last: "" });
  }
  if (!items.length) return;
  (root as HTMLElement).dataset.fpCounted = "1";
  const t0 = performance.now(), dur = COUNT.duration * 1000;
  const write = (it: (typeof items)[number], text: string) => { it.n.nodeValue = text; it.last = text; };
  items.forEach((it) => write(it, `${it.lead}${formatLike(it.p, 0)}${it.trail}`));
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    let live = false;
    for (const it of items) {
      if (!it.last || it.n.nodeValue !== it.last) { it.last = ""; continue; } // React rewrote it: React's value wins
      write(it, k >= 1 ? it.full : `${it.lead}${formatLike(it.p, it.p.value * e)}${it.trail}`); // ends on the exact original text
      live = true;
    }
    if (k < 1 && live) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
/** Section titles (h2/h3 with a single text node) write themselves in; aria-label carries the full text throughout. */
function typeTitles(root: Element) {
  root.querySelectorAll<HTMLElement>("h2, h3").forEach((h) => {
    if (h.dataset.fpTyped || h.closest("svg, [data-no-type]")) return;
    const nodes = Array.from(h.childNodes).filter((c) => c.nodeType === 3 && c.nodeValue!.trim());
    if (nodes.length !== 1) return;
    const n = nodes[0] as Text, full = n.nodeValue!;
    if (full.length > 70) return;
    h.dataset.fpTyped = "1";
    if (!h.getAttribute("aria-label")) h.setAttribute("aria-label", h.textContent?.trim() ?? full);
    const t0 = performance.now(), total = TYPE.total * 1000;
    let last = "";
    const tick = () => {
      if (last && n.nodeValue !== last) return; // React rewrote it: stop
      const k = Math.min(1, (performance.now() - t0) / total), done = Math.floor(k * full.length);
      const tail = Math.min(full.length - done, Math.ceil(full.length * TYPE.scramble));
      let s = full.slice(0, done);
      for (let i = 0; i < tail; i++) s += full[done + i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      // keep the line length stable: pad with non-breaking spaces until the text is complete
      n.nodeValue = last = k >= 1 ? full : s.padEnd(full.length, "\u00a0");
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function AutoReveal() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.querySelector("main");
    if (!main) return;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        el.dataset.fp = "in";
        countUp(el);
        if (el.matches(".panel")) typeTitles(el);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });

    const register = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
        if (el.dataset.fp || el.closest(SKIP) || el.parentElement?.closest("[data-fp=pending]") && !el.matches("li, tr")) return;
        // stagger among siblings that reveal together
        const sibs = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.matches(TARGETS)) : [el];
        const i = Math.max(0, sibs.indexOf(el));
        el.style.setProperty("--fp-delay", `${Math.min(REVEAL.maxStagger, i * REVEAL.stagger)}s`);
        el.dataset.fp = "pending";
        io.observe(el);
      });
      scope.querySelectorAll<HTMLElement>(".rule, hr").forEach((el) => { if (!el.dataset.fpLine) { el.dataset.fpLine = "1"; } });
    };
    register(main);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) register(n as Element); });
    });
    mo.observe(main, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}
