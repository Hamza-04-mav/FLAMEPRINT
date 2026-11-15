"use client";

import { Component, type ReactNode } from "react";

/**
 * Error boundary for the optional WebGL scenes. If a 3D chunk fails to load or a
 * canvas throws, show a quiet fallback with a Reload action instead of letting the
 * whole view crash. (Dev-only stale-chunk failures are the common trigger.)
 */
export class Safe3D extends Component<{ children: ReactNode; label?: string }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }

  render() {
    if (this.state.err) {
      return (
        <div className="grid h-full min-h-[200px] place-items-center p-6 text-center">
          <div className="space-y-3">
            <p className="text-[13px] text-mute">{this.props.label ?? "The 3D view"} couldn’t load.</p>
            <button onClick={() => { if (typeof window !== "undefined") window.location.reload(); }} className="btn btn-outline !py-1.5">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
