import React from 'react';
import { Compass, RotateCcw, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppScreen } from '../types';

interface NavbarProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onReset: () => void;
  onLoadPreset: (
    presetType: 'feasible' | 'impossible' | 'budget_fail' | 'deadline_fail' | 'multi_fail'
  ) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  onReset,
  onLoadPreset,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            id="brand-logo-btn"
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900 font-sans">
                  Smart City Explorer
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  AI + Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Constraint-Aware City Exploration Planner
              </p>
            </div>
          </div>

          {/* Quick Demo Presets for Hackathon Judges */}
          <div className="hidden md:flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="px-2 py-1 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
              Judge Scenarios:
            </span>
            <button
              id="demo-preset-feasible-btn"
              onClick={() => onLoadPreset('feasible')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white shadow-xs font-medium text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors border border-emerald-200/60"
              title="Loads realistic 3-destination trip that fits within 4h deadline"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>✓ Feasible</span>
            </button>
            <button
              id="demo-preset-impossible-btn"
              onClick={() => onLoadPreset('impossible')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white shadow-xs font-medium text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors border border-amber-200/60"
              title="Loads 5-destination overbooked trip to test Screen 7 constraint failure & AI alternative"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>⚠️ Overbooked</span>
            </button>
            <button
              id="demo-preset-budget-btn"
              onClick={() => onLoadPreset('budget_fail')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white shadow-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-colors border border-rose-200/60"
              title="Loads scenario where travel & tickets exceed tight budget"
            >
              <span className="font-bold">₹</span>
              <span>Budget Fail</span>
            </button>
            <button
              id="demo-preset-deadline-btn"
              onClick={() => onLoadPreset('deadline_fail')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white shadow-xs font-medium text-purple-700 hover:bg-purple-50 hover:text-purple-800 transition-colors border border-purple-200/60"
              title="Loads scenario where return deadline is breached"
            >
              <span>⏱ Deadline Fail</span>
            </button>
            <button
              id="demo-preset-multi-btn"
              onClick={() => onLoadPreset('multi_fail')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white shadow-xs font-medium text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors border border-indigo-200/60"
              title="Loads scenario where multiple constraints fail simultaneously"
            >
              <span>⚡ Multi-Fail</span>
            </button>
          </div>

          {/* Right Action */}
          <div className="flex items-center gap-3">
            {currentScreen !== 'landing' && (
              <button
                id="reset-plan-nav-btn"
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Plan</span>
              </button>
            )}
            {currentScreen === 'landing' ? (
              <button
                id="header-start-plan-btn"
                onClick={() => onNavigate('mode_select')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95"
              >
                <span>Start Planning</span>
                <span className="text-emerald-400">→</span>
              </button>
            ) : (
              <button
                id="header-home-btn"
                onClick={() => onNavigate('landing')}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1"
              >
                Home
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
