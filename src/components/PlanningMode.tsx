import React from 'react';
import { MapPin, Sparkles, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PlanningMode as ModeType } from '../types';

interface PlanningModeProps {
  onSelectMode: (mode: ModeType) => void;
  onBack: () => void;
}

export const PlanningMode: React.FC<PlanningModeProps> = ({ onSelectMode, onBack }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      
      {/* Top Breadcrumb & Title */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1 transition-colors"
        >
          ← Back to Overview
        </button>
        <span className="block text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">
          Step 1 of 4 • Planning Approach
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
          How would you like to plan?
        </h2>
        <p className="text-base text-slate-600 mt-3">
          Select whether you already have specific sights in mind or want our AI to recommend an optimal selection tailored to your constraints.
        </p>
      </div>

      {/* Two Large Distinctive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* CARD 1: Manual Selection */}
        <div
          id="mode-card-manual"
          onClick={() => onSelectMode('manual')}
          className="group relative bg-white hover:bg-slate-50/50 rounded-3xl p-8 sm:p-10 border-2 border-slate-200/90 hover:border-emerald-500 shadow-lg shadow-slate-100 hover:shadow-2xl hover:shadow-emerald-500/10 cursor-pointer transition-all duration-300 flex flex-col justify-between"
        >
          {/* Subtle Top Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
              <MapPin className="w-7 h-7 text-emerald-700" />
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Direct Choice
            </span>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-extrabold text-slate-900 group-hover:text-emerald-800 transition-colors">
              I know where I want to go
            </h3>

            <p className="text-slate-600 leading-relaxed text-sm">
              “Choose the places yourself and let Smart City Explorer check whether you can realistically visit them.”
            </p>

            {/* Feature bullets */}
            <div className="pt-2 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pick from curated city landmarks or search points</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instant dwell time and entrance fee estimation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Automatic route sequencing & feasibility test</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              id="choose-my-places-btn"
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 group-hover:shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <span>Choose my places</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* CARD 2: AI Recommendation Mode */}
        <div
          id="mode-card-ai"
          onClick={() => onSelectMode('ai_suggest')}
          className="group relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-8 sm:p-10 border-2 border-slate-800 hover:border-teal-400 shadow-xl hover:shadow-2xl hover:shadow-teal-500/20 cursor-pointer transition-all duration-300 flex flex-col justify-between"
        >
          {/* Subtle Top Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 group-hover:scale-110 transition-transform">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-950/80 text-teal-300 border border-teal-500/40">
              Smart Generator
            </span>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-extrabold text-white group-hover:text-teal-300 transition-colors">
              Suggest places for me
            </h3>

            <p className="text-slate-300 leading-relaxed text-sm">
              “Tell us your interests, available time and budget, and let AI suggest places that may fit your trip.”
            </p>

            {/* Feature bullets */}
            <div className="pt-2 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Interests-based clustering (History, Food, Views)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Choose pace: Relaxed, Balanced, or High-Density</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>AI recommendations are checked against your constraints before being included</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <button
              id="find-places-for-me-btn"
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 group-hover:shadow-xl flex items-center justify-center gap-2 transition-all"
            >
              <span>Find places for me</span>
              <Sparkles className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>

      </div>

      {/* Trust Reminder */}
      <div className="mt-12 text-center">
        <p className="text-xs text-slate-500">
          Whichever mode you select, your constraints (start location, deadline, budget) are checked against planning estimates before you finalize.
        </p>
      </div>

    </div>
  );
};
