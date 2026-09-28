import React, { useRef } from 'react';
import {
  Clock,
  Wallet,
  MapPin,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Navigation,
  Route,
  ChevronDown,
  Layers,
  Check,
} from 'lucide-react';

interface LandingPageProps {
  onStartPlanning: () => void;
  onExploreFeasibleDemo: () => void;
  onExploreImpossibleDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartPlanning,
  onExploreFeasibleDemo,
  onExploreImpossibleDemo,
}) => {
  const howItWorksRef = useRef<HTMLDivElement | null>(null);

  const scrollToHowItWorks = () => {
    if (howItWorksRef.current) {
      howItWorksRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative bg-slate-950 text-slate-100 overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Ambient background glow & cartographic grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-emerald-950/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* ============================================================ */}
      {/* 1. HERO SECTION: "Turn Free Hours Into Adventures" */}
      {/* ============================================================ */}
      <section className="relative pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-24 lg:pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Column */}
          <div className="lg:col-span-6 space-y-8 text-center lg:text-left">
            
            {/* Top Quiet Kicker */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Smart City Exploration & Verification</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400">Time & Budget Aware</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] text-balance">
                Turn Free Hours <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Into Adventures.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
                Tell us where you are, how much time you have, and what you can spend.
                We&apos;ll help you discover what is realistically worth exploring.
              </p>
            </div>

            {/* Primary & Secondary Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                id="hero-primary-cta"
                onClick={onStartPlanning}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 text-base group"
              >
                <span>Start Exploring</span>
                <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                id="hero-secondary-cta"
                onClick={scrollToHowItWorks}
                className="w-full sm:w-auto px-6 py-4 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl border border-slate-700 hover:border-slate-600 shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
              >
                <span>See How It Works</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Value Proof Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Enforces return deadlines</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Calculates transit & ticket costs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Real routing geometry</span>
              </div>
            </div>

          </div>

          {/* Right Hero Visual: Journey Concept Visualization */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-lg bg-slate-900/90 rounded-3xl p-6 shadow-2xl shadow-emerald-950/30 border border-slate-800 backdrop-blur-xl">
              
              {/* Card Top Indicator */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse" />
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
                    Smart Journey Concept
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-800/60">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Time Cushion</span>
                </div>
              </div>

              {/* Simplified Journey Concept Flow:
                  YOU ARE HERE -> DISCOVER -> EXPLORE -> RETURN ON TIME */}
              <div className="relative space-y-3.5">
                
                {/* Connecting vertical circuit line */}
                <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-500 via-teal-500 to-cyan-400 opacity-40 -z-0" />

                {/* Step 1: YOU ARE HERE */}
                <div className="relative z-10 flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">
                        Origin Anchor
                      </div>
                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>YOU ARE HERE</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-400 block">02:00 PM</span>
                    <span className="text-[10px] text-slate-500">Departure</span>
                  </div>
                </div>

                {/* Step 2: DISCOVER */}
                <div className="relative z-10 flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-teal-300 tracking-wider uppercase">
                        AI Matched
                      </div>
                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>DISCOVER</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-medium text-teal-300 block">Radius 8.5 km</span>
                    <span className="text-[10px] text-slate-500">Filtered by budget</span>
                  </div>
                </div>

                {/* Step 3: EXPLORE */}
                <div className="relative z-10 flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-cyan-300 tracking-wider uppercase">
                        Live Circuit
                      </div>
                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>EXPLORE</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-cyan-300 block">3 Stops · Auto/Walk</span>
                    <span className="text-[10px] text-slate-500">2h 15m dwell time</span>
                  </div>
                </div>

                {/* Step 4: RETURN ON TIME */}
                <div className="relative z-10 flex items-center justify-between p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/30">
                      4
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">
                        Guaranteed Buffer
                      </div>
                      <div className="text-sm font-bold text-emerald-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>RETURN ON TIME</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono font-bold text-emerald-300 block">05:12 PM</span>
                    <span className="text-[10px] text-emerald-400/80">Deadline 05:30 PM</span>
                  </div>
                </div>

              </div>

              {/* Bottom Quick Test Banner for Demo */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 font-medium">Quick Hackathon Sandbox:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onExploreFeasibleDemo}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-medium transition-colors"
                    title="Load feasible 3h plan demo"
                  >
                    ✓ Feasible Demo
                  </button>
                  <button
                    onClick={onExploreImpossibleDemo}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-medium transition-colors"
                    title="Load overbooked failure demo"
                  >
                    ⚠️ Overbooked Demo
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. THE PROBLEM & THREE FEATURE BLOCKS SECTION */}
      {/* ============================================================ */}
      <section className="relative py-20 bg-slate-900/60 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header: The Problem */}
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
              Your time is limited. Your city isn&apos;t.
            </h2>
            <div className="space-y-1.5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
              <p>When you&apos;re in an unfamiliar city with only a few free hours,</p>
              <p>finding places is easy.</p>
              <p className="font-semibold text-emerald-400">Figuring out what actually fits your time and budget is harder.</p>
            </div>
          </div>

          {/* Three Visual Feature Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            
            {/* Block 1: TIME */}
            <div className="group relative bg-slate-950/80 rounded-2xl p-7 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                ⏱ Time Aware
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Plan around the hours you actually have.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                We calculate real road transit velocities, required on-site dwell times, and add safety buffers so you never miss a train, flight, or checkout.
              </p>
            </div>

            {/* Block 2: BUDGET */}
            <div className="group relative bg-slate-950/80 rounded-2xl p-7 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1">
                💰 Budget Aware
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Know the estimated cost before you go.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Aggregate transit fares, entry tickets, boat transfers, and refreshment estimates into an upfront total tailored to your group size.
              </p>
            </div>

            {/* Block 3: LOCAL EXPLORATION */}
            <div className="group relative bg-slate-950/80 rounded-2xl p-7 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
                📍 Local Exploration
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Discover places worth visiting around you.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Smart spatial clustering surfaces high-rated landmarks, heritage sites, and local hotspots within achievable reach of your starting point.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. HOW IT WORKS SECTION (Four Steps) */}
      {/* ============================================================ */}
      <section ref={howItWorksRef} id="how-it-works" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-16">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Simple 4-Step Process
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How It Works
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            From arrival to departure without scheduling stress.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Step 01 */}
          <div className="relative bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all">
            <div className="text-3xl font-extrabold font-mono text-emerald-400 mb-4">
              01
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Choose where you are
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Set your current origin, hotel, or station and optionally specify where you need to return.
            </p>
          </div>

          {/* Step 02 */}
          <div className="relative bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all">
            <div className="text-3xl font-extrabold font-mono text-teal-400 mb-4">
              02
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Tell us your time & budget
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Define your start time, hard return deadline, maximum spending limit, and travel party count.
            </p>
          </div>

          {/* Step 03 */}
          <div className="relative bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all">
            <div className="text-3xl font-extrabold font-mono text-cyan-400 mb-4">
              03
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Pick the places you want
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select your own destinations or let our AI recommend high-rated spots matching your interests.
            </p>
          </div>

          {/* Step 04 */}
          <div className="relative bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all">
            <div className="text-3xl font-extrabold font-mono text-emerald-300 mb-4">
              04
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Get your realistic itinerary
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Receive a step-by-step verified route with timeline buffers, transport options, and turnkey navigation.
            </p>
          </div>

        </div>

      </section>

      {/* ============================================================ */}
      {/* 4. VERIFICATION ENGINE COMPARISON SECTION */}
      {/* ============================================================ */}
      <section className="py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-950 rounded-3xl p-8 sm:p-10 border border-slate-800 relative overflow-hidden">
            
            <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Core Engineering Standard</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                AI Recommends. Our System Verifies.
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                Generic travel assistants hallucinate 6 destinations in 2 hours. Smart City Explorer checks real-world constraints before confirming.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="font-bold text-rose-400 flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Unchecked Generic AI</span>
                </div>
                <p className="text-slate-400">
                  Suggests famous sights without knowing your train departure deadline or local transit congestion.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Smart City Explorer</span>
                </div>
                <p className="text-emerald-100/90">
                  Calculates real transit velocities, ticket queues, and safety buffers; flags impossible trips immediately.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. FINAL CTA SECTION */}
      {/* ============================================================ */}
      <section className="py-20 lg:py-28 relative text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight text-balance">
            Your next adventure might already fit your schedule.
          </h2>

          <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Enter your free hours and budget to get a validated exploration circuit right now.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="final-cta-btn"
              onClick={onStartPlanning}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 text-base group"
            >
              <span>Explore the City</span>
              <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </section>

    </div>
  );
};
