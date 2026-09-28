import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wallet,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Sparkles,
  MapPin,
  Utensils,
  Car,
  ChevronRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import { Destination, TripConstraints, FeasibilityResult } from '../types';
import {
  analyzeTripFeasibility,
  formatDuration,
  formatCategoryName,
  getDestinationVisitDuration,
  getDestinationEstimatedDuration,
  formatVisitDurationDisplay,
} from '../utils/calculator';
import { RouteResult, computeTripLegs } from '../services/routesService';
import { FeasibilitySummaryCard } from './FeasibilitySummaryCard';

interface FeasibilityAnalysisProps {
  constraints: TripConstraints;
  selectedDestinations: Destination[];
  feasibilityResult?: FeasibilityResult;
  routeLegsMap?: Map<string, RouteResult>;
  onUseAlternativePlan: (alternativeDestinations: Destination[]) => void;
  onModifyPlan: () => void;
  onProceedToItinerary: () => void;
  onLoadImpossibleTest: () => void;
  onLoadFeasibleTest: () => void;
  onLoadPreset?: (
    preset: 'feasible' | 'impossible' | 'budget_fail' | 'deadline_fail' | 'multi_fail'
  ) => void;
  onUpdateVisitDuration?: (destId: string, durationMinutes?: number) => void;
}

export const FeasibilityAnalysis: React.FC<FeasibilityAnalysisProps> = ({
  constraints,
  selectedDestinations,
  feasibilityResult,
  routeLegsMap: propRouteLegsMap,
  onUseAlternativePlan,
  onModifyPlan,
  onProceedToItinerary,
  onLoadImpossibleTest,
  onLoadFeasibleTest,
  onLoadPreset,
  onUpdateVisitDuration,
}) => {
  const [analyzingProgress, setAnalyzingProgress] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [localRouteLegsMap, setLocalRouteLegsMap] = useState<Map<string, RouteResult> | undefined>(undefined);

  const activeRouteLegsMap = propRouteLegsMap || localRouteLegsMap;

  useEffect(() => {
    let isMounted = true;
    if (propRouteLegsMap || selectedDestinations.length === 0) return;

    computeTripLegs(
      constraints.startLocation,
      selectedDestinations,
      constraints.sameReturnLocation ? constraints.startLocation : constraints.returnLocation,
      constraints.transportPreference,
      constraints.rentalPickupShop,
      constraints.segmentTransportModes,
      constraints.startCoordinates,
      constraints.sameReturnLocation ? constraints.startCoordinates : constraints.returnCoordinates,
      constraints.sameReturnLocation
    )
      .then((legs) => {
        if (isMounted) {
          setLocalRouteLegsMap(legs);
        }
      })
      .catch((err) => {
        console.warn('Routes API call fallback engaged:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [
    propRouteLegsMap,
    selectedDestinations,
    constraints.startLocation,
    constraints.returnLocation,
    constraints.sameReturnLocation,
    constraints.transportPreference,
    constraints.rentalPickupShop,
    constraints.segmentTransportModes,
    constraints.startCoordinates,
    constraints.returnCoordinates,
  ]);

  // Use shared feasibility result or compute with routes
  const result: FeasibilityResult =
    feasibilityResult ||
    analyzeTripFeasibility(constraints, selectedDestinations, {
      routeLegsMap: activeRouteLegsMap,
    });

  const verificationStages = [
    'Checking travel time & circuit duration',
    'Calculating destination visit duration',
    'Estimating transportation & entrance cost',
    'Checking user budget limit',
    'Verifying return deadline compliance',
    'Optimizing geographic waypoint sequence',
  ];

  // Animated verification simulation on first mount
  useEffect(() => {
    setAnalyzingProgress(0);
    setCompletedSteps(0);

    const interval = setInterval(() => {
      setCompletedSteps((prev) => {
        if (prev < verificationStages.length) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 280);

    return () => clearInterval(interval);
  }, [selectedDestinations.length, constraints.budget, constraints.returnDeadline]);

  const isScanning = completedSteps < verificationStages.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <button
            onClick={onModifyPlan}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 mb-1 inline-flex items-center gap-1 transition-colors"
          >
            ← Modify Destination List
          </button>
          <span className="block text-xs font-bold text-emerald-600 uppercase tracking-widest">
            Core Engine • Feasibility Analysis
          </span>
          <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">
            {isScanning ? 'Analyzing your trip…' : 'Constraint Verification Report'}
          </h2>
        </div>

        {/* Hackathon Judge quick toggles */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs self-start sm:self-auto">
          <span className="text-[11px] font-bold text-slate-500 px-2">Judge Scenarios:</span>
          <button
            id="judge-test-feasible-btn"
            onClick={onLoadFeasibleTest}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
              result.isFeasible
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            ✓ Feasible (Screen 6)
          </button>
          <button
            id="judge-test-impossible-btn"
            onClick={onLoadImpossibleTest}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
              !result.isFeasible
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            ⚠️ Overbooked (Screen 7)
          </button>
          {onLoadPreset && (
            <>
              <button
                id="judge-test-budget-btn"
                onClick={() => onLoadPreset('budget_fail')}
                className="px-2.5 py-1 rounded-xl font-bold bg-white text-rose-700 hover:bg-rose-50 border border-rose-200/60 transition-all"
              >
                ₹ Budget Fail
              </button>
              <button
                id="judge-test-deadline-btn"
                onClick={() => onLoadPreset('deadline_fail')}
                className="px-2.5 py-1 rounded-xl font-bold bg-white text-purple-700 hover:bg-purple-50 border border-purple-200/60 transition-all"
              >
                ⏱ Deadline Fail
              </button>
              <button
                id="judge-test-multi-btn"
                onClick={() => onLoadPreset('multi_fail')}
                className="px-2.5 py-1 rounded-xl font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200/60 transition-all"
              >
                ⚡ Multi-Fail
              </button>
            </>
          )}
        </div>
      </div>

      {/* Verification Scanner Steps */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Constraint Verification Pipeline
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {selectedDestinations.length === 0
              ? 'Pending Destination Selection'
              : `${Math.min(completedSteps, result.checks.length)} of ${result.checks.length} Checks Finished`}
          </span>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {result.checks.map((check, idx) => {
            const isFinished = completedSteps > idx || selectedDestinations.length === 0;
            const isCurrent = completedSteps === idx && selectedDestinations.length > 0;
            const isFailed = isFinished && check.status === 'failed';
            const isWarning = isFinished && check.status === 'warning';
            const isPassed = isFinished && check.status === 'passed';
            const isPending = isFinished && check.status === 'pending';

            return (
              <div
                key={check.id}
                className={`p-3.5 rounded-2xl border text-xs transition-all ${
                  isFailed
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
                    : isWarning
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
                    : isPassed
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : isPending
                    ? 'bg-slate-50/90 border-slate-200 text-slate-700'
                    : isCurrent
                    ? 'bg-amber-50/60 border-amber-300 text-amber-900 shadow-xs animate-pulse'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 font-bold truncate">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                        isFailed
                          ? 'bg-rose-600 text-white'
                          : isWarning
                          ? 'bg-amber-500 text-white'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : isPending
                          ? 'bg-slate-300 text-slate-700'
                          : isCurrent
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isFailed ? '✕' : isWarning ? '!' : isPassed ? '✓' : isPending ? '—' : idx + 1}
                    </div>
                    <span className="truncate">{check.label}</span>
                  </div>

                  {isFinished && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                        isFailed
                          ? 'bg-rose-600 text-white'
                          : isWarning
                          ? 'bg-amber-500 text-white'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {check.status === 'passed'
                        ? 'PASS'
                        : check.status === 'failed'
                        ? 'FAIL'
                        : check.status === 'pending'
                        ? 'PENDING'
                        : 'WARN'}
                    </span>
                  )}
                </div>

                {isFinished && (
                  <div className="text-[11px] font-normal leading-snug pl-7 space-y-1">
                    <p className="opacity-90">{check.detail}</p>
                    {check.metric && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-white/70 border border-slate-200/60 text-[10px] font-semibold text-slate-700">
                        {check.metric}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Feasibility Summary Card (Requirements 12, 13, 14) */}
      {selectedDestinations.length > 0 && (
        <FeasibilitySummaryCard
          constraints={constraints}
          feasibilityResult={result}
          className="mb-8"
        />
      )}

      {/* ========================================================================= */}
      {/* 3 STATES: EMPTY DESTINATIONS / FEASIBLE PLAN / INFEASIBLE PLAN */}
      {/* ========================================================================= */}
      {selectedDestinations.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/90 shadow-xs text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-2xl">
            📍
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-2xl font-extrabold text-slate-900">
              No Destinations Selected
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Select at least one destination to create an itinerary.
            </p>
          </div>
          <div>
            <button
              onClick={onModifyPlan}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all text-sm inline-flex items-center gap-2"
            >
              <span>← Select Destinations</span>
            </button>
          </div>
        </div>
      ) : result.isFeasible ? (
        <div className="space-y-8 animate-fade-in">
          
          {/* Large Green / Positive Status Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-600/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/20 text-white border border-white/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>ALL CONSTRAINTS SATISFIED</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                ✓ PLAN IS FEASIBLE
              </h1>
              <p className="text-emerald-100 text-sm max-w-2xl font-medium">
                You can realistically complete this trip within your available time and budget, returning with a comfortable {result.bufferMinutes}-minute safety buffer before your {result.deadlineTime} deadline.
              </p>
            </div>

            <button
              id="view-itinerary-feasible-btn"
              onClick={onProceedToItinerary}
              className="px-8 py-4 bg-white hover:bg-slate-50 text-emerald-950 font-extrabold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-base shrink-0"
            >
              <span>View Final Itinerary</span>
              <ArrowRight className="w-5 h-5 text-emerald-700" />
            </button>
          </div>

          {/* 4 Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* TIME CARD */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  TIME
                </span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-extrabold text-slate-900">
                  {formatDuration(result.timeUsedMinutes)}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  of {formatDuration(result.timeAvailableMinutes)} available
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Fits within exploration window</span>
              </div>
            </div>

            {/* BUDGET CARD */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  BUDGET
                </span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-extrabold text-slate-900">
                  {constraints.currency}{result.totalCost}{result.hasUnknownFares ? '+' : ''}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  of {constraints.currency}{result.budget} budget ceiling
                  {result.totalTransportCost !== undefined && (
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      Transit: {constraints.currency}{result.totalTransportCost} • Entry: {constraints.currency}{result.totalEntryCost ?? 0}
                    </span>
                  )}
                </div>
              </div>
              <div className={`mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold flex items-center gap-1 ${
                result.hasUnknownFares ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {result.hasUnknownFares ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{result.unknownFaresCount ?? 1} transit fare(s) unavailable</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>₹{result.budget - result.totalCost} surplus remaining</span>
                  </>
                )}
              </div>
            </div>

            {/* RETURN CARD */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  RETURN
                </span>
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-extrabold text-emerald-700">
                  {result.expectedReturnTime}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  vs {result.deadlineTime} deadline
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Estimated on-time return</span>
              </div>
            </div>

            {/* BUFFER CARD */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  BUFFER
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-extrabold text-slate-900">
                  {result.bufferMinutes} minutes
                </div>
                <div className="text-xs font-medium text-slate-500">
                  safety cushion for unexpected delays
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Planning buffer against delays</span>
              </div>
            </div>

          </div>

          {/* Horizontal Route / Timeline (As Requested in Screen 6) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Sequenced Route Flow
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                START ↓ Stops ↓ Food ↓ RETURN
              </span>
            </div>

            {/* Horizontal flow badges */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 overflow-x-auto pb-4 pt-2">
              
              {/* START */}
              <div className="flex-1 w-full md:w-auto bg-slate-900 text-white p-4 rounded-2xl text-center space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-400">START</span>
                <div className="font-extrabold text-xs truncate">{constraints.startLocation}</div>
                <div className="text-[11px] text-slate-300">{constraints.startTime}</div>
              </div>

              <div className="text-slate-400 font-bold hidden md:block">→</div>
              <div className="text-slate-400 font-bold md:hidden">↓</div>

              {/* Destinations & Intermediate Food */}
              {selectedDestinations.map((dest, i) => {
                const estDuration = getDestinationEstimatedDuration(dest);
                const hasCustomDuration =
                  typeof dest.userVisitMinutes === 'number' &&
                  dest.userVisitMinutes > 0 &&
                  dest.userVisitMinutes !== estDuration;
                const currentDuration = getDestinationVisitDuration(dest);

                return (
                  <React.Fragment key={dest.id}>
                    <div className="flex-1 w-full md:w-auto bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-1.5 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-emerald-800">
                        Stop {i + 1} • {formatCategoryName(dest.category)}
                      </span>
                      <div className="font-extrabold text-xs text-slate-900 truncate" title={dest.name}>
                        {dest.name}
                      </div>

                      {/* Display Estimated vs Planned Duration (Requirement 8) */}
                      {(() => {
                        const durationInfo = formatVisitDurationDisplay(dest);
                        return (
                          <div className="text-[11px] text-emerald-900 font-semibold space-y-0.5">
                            <div className="text-[10px] text-slate-700 font-medium">
                              {durationInfo.label}
                            </div>
                            <div>
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  durationInfo.isEstimated
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : durationInfo.isUserCustomized
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {durationInfo.badgeLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Duration Adjustment Controls */}
                      {onUpdateVisitDuration && (
                        <div className="flex items-center justify-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(10, currentDuration - 15);
                              onUpdateVisitDuration(dest.id, next);
                            }}
                            className="w-5 h-5 rounded-md bg-white border border-emerald-300 hover:bg-emerald-100 flex items-center justify-center text-xs font-bold text-slate-700 cursor-pointer shadow-2xs"
                            title="Decrease planned visit by 15 min"
                          >
                            -
                          </button>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold min-w-[36px] text-center ${
                              hasCustomDuration
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-800'
                            }`}
                          >
                            {currentDuration}m
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(240, currentDuration + 15);
                              onUpdateVisitDuration(dest.id, next);
                            }}
                            className="w-5 h-5 rounded-md bg-white border border-emerald-300 hover:bg-emerald-100 flex items-center justify-center text-xs font-bold text-slate-700 cursor-pointer shadow-2xs"
                            title="Increase planned visit by 15 min"
                          >
                            +
                          </button>
                          {hasCustomDuration && (
                            <button
                              type="button"
                              onClick={() => onUpdateVisitDuration(dest.id, undefined)}
                              className="text-[9px] text-emerald-700 hover:text-emerald-900 underline font-semibold ml-0.5 cursor-pointer"
                              title="Reset to estimate"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-500 pt-0.5">
                        {dest.entryCost === 0 ? 'Free entry' : `₹${dest.entryCost}/person`}
                      </div>
                    </div>

                  {/* Insert Food break representation if long trip */}
                  {i === 1 && selectedDestinations.length >= 3 && (
                    <>
                      <div className="text-slate-400 font-bold hidden md:block">→</div>
                      <div className="text-slate-400 font-bold md:hidden">↓</div>
                      <div className="flex-1 w-full md:w-auto bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center space-y-1 shadow-xs">
                        <span className="text-[10px] uppercase font-bold text-amber-800 flex items-center justify-center gap-1">
                          <Utensils className="w-3 h-3" /> Food
                        </span>
                        <div className="font-extrabold text-xs text-slate-900">
                          Refreshment Break
                        </div>
                        <div className="text-[11px] text-amber-700 font-medium">
                          30 min • ₹70
                        </div>
                      </div>
                    </>
                  )}

                  <div className="text-slate-400 font-bold hidden md:block">→</div>
                  <div className="text-slate-400 font-bold md:hidden">↓</div>
                </React.Fragment>
              );
            })}

              {/* RETURN */}
              <div className="flex-1 w-full md:w-auto bg-emerald-700 text-white p-4 rounded-2xl text-center space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-200">RETURN</span>
                <div className="font-extrabold text-xs truncate">
                  {constraints.returnLocation || constraints.startLocation}
                </div>
                <div className="text-[11px] text-emerald-100 font-bold">
                  {result.expectedReturnTime}
                </div>
              </div>

            </div>

            {/* Bottom confirmation controls */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={onModifyPlan}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Adjust stops or budget</span>
              </button>

              <button
                id="continue-to-itinerary-btn"
                onClick={onProceedToItinerary}
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
              >
                <span>View Full Itinerary Timeline</span>
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* ========================================================================= */
        /* SCREEN 7 — IMPOSSIBLE PLAN / FAILURE STATE */
        /* ========================================================================= */
        <div className="space-y-8 animate-fade-in">
          
          {/* Large Warning Banner */}
          <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700 rounded-3xl p-8 text-white shadow-xl shadow-rose-600/10 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/20 text-white border border-white/30">
              <AlertTriangle className="w-4 h-4 text-amber-200" />
              <span>CONSTRAINT VIOLATION DETECTED</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {result.primaryFailureCategory === 'multiple_constraints_failed'
                ? '⚠️ MULTIPLE CONSTRAINTS FAILED (Time & Budget)'
                : result.primaryFailureCategory === 'deadline_exceeded'
                ? '⏱ RETURN DEADLINE EXCEEDED'
                : result.primaryFailureCategory === 'insufficient_time'
                ? '⏳ INSUFFICIENT TIME WINDOW'
                : result.primaryFailureCategory === 'budget_exceeded'
                ? '💳 TRIP BUDGET EXCEEDED'
                : "⚠️ THIS PLAN DOESN'T FIT"}
            </h1>

            <div className="space-y-1.5 text-rose-100 text-sm sm:text-base max-w-3xl leading-relaxed">
              <p className="font-semibold">
                Your selected {selectedDestinations.length}-stop itinerary cannot be completed without violating constraints:
              </p>
              <div className="space-y-1 pl-1">
                {result.failureReasons.map((reason, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-rose-50">
                    <span className="text-amber-300 font-extrabold">•</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Diagnostic Reasons List */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-200/90 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-rose-950 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <span>Verification Failure Breakdown</span>
            </h3>

            <div className="space-y-3">
              {result.failureReasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-950 font-bold text-sm flex items-start gap-3"
                >
                  <span className="text-rose-600 text-base leading-none">❌</span>
                  <span className="leading-snug">{reason}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 pt-2">
              If you attempted this itinerary as planned, you would either miss your return deadline or exceed your designated budget.
            </p>
          </div>

          {/* CLEAR COMPARISON BREAKDOWN: Selected vs Feasible Alternative vs Excluded */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Destination Partitioning Analysis
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">
                Constraint-Aware Route Optimization Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                The constraint engine analyzed all combinations to discover the highest-value feasible itinerary while strictly adhering to your deadline and budget.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 1. Selected by user */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Selected by user
                  </span>
                  <span className="text-xs font-extrabold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">
                    {result.selectedDestinations.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {result.selectedDestinations.map((dest, idx) => (
                    <div
                      key={dest.id}
                      className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs space-y-1"
                    >
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{idx + 1}. {dest.name}</span>
                        <span className="text-[10px] text-slate-600 font-semibold">
                          {dest.userVisitMinutes && dest.userVisitMinutes !== getDestinationEstimatedDuration(dest)
                            ? `Planned: ${dest.userVisitMinutes}m`
                            : `Est. ${getDestinationEstimatedDuration(dest)}m`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>{formatCategoryName(dest.category)}</span>
                        <span>{dest.entryCost === 0 ? 'Free' : `₹${dest.entryCost}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Feasible alternative */}
              <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    Feasible alternative
                  </span>
                  <span className="text-xs font-extrabold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                    {result.includedDestinations.length} fits
                  </span>
                </div>
                {result.includedDestinations.length > 0 ? (
                  <div className="space-y-2">
                    {result.includedDestinations.map((dest) => (
                      <div
                        key={dest.id}
                        className="bg-white p-3 rounded-xl border border-emerald-300 text-xs space-y-1 shadow-2xs"
                      >
                        <div className="font-bold text-emerald-950 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="text-emerald-600 font-extrabold">✓</span>
                            <span>{dest.name}</span>
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700">
                            {dest.userVisitMinutes && dest.userVisitMinutes !== getDestinationEstimatedDuration(dest)
                              ? `Planned: ${dest.userVisitMinutes}m`
                              : `Est. ${getDestinationEstimatedDuration(dest)}m`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>{formatCategoryName(dest.category)}</span>
                          <span className="font-medium text-slate-700">{dest.entryCost === 0 ? 'Free' : `₹${dest.entryCost}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-2">
                    No destination combination fits within this window. Consider increasing time or budget.
                  </p>
                )}
              </div>

              {/* 3. Excluded with calculated reasons */}
              <div className="bg-rose-50/60 rounded-2xl p-5 border border-rose-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">
                    Excluded (Calculated Impact)
                  </span>
                  <span className="text-xs font-extrabold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                    {result.excludedDestinations.length}
                  </span>
                </div>
                {result.excludedDestinations.length > 0 ? (
                  <div className="space-y-2">
                    {result.excludedDestinations.map(({ destination, reason }) => (
                      <div
                        key={destination.id}
                        className="bg-white p-3 rounded-xl border border-rose-200 text-xs space-y-1 shadow-2xs"
                      >
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-rose-700">
                            <span className="font-extrabold">✗</span>
                            <span>{destination.name}</span>
                          </span>
                          <span className="text-[10px] text-rose-600 font-semibold">
                            {destination.userVisitMinutes && destination.userVisitMinutes !== getDestinationEstimatedDuration(destination)
                              ? `Planned: ${destination.userVisitMinutes}m`
                              : `Est. ${getDestinationEstimatedDuration(destination)}m`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {formatCategoryName(destination.category)} • {destination.entryCost === 0 ? 'Free entry' : `₹${destination.entryCost}`}
                        </div>
                        <p className="text-[11px] text-rose-900/90 font-medium leading-relaxed bg-rose-50/70 p-2 rounded-lg border border-rose-100">
                          {reason}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-2">
                    None excluded.
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* FEASIBLE ALTERNATIVE SUGGESTION (Crucial requirement in Screen 7) */}
          {result.alternativePlan && (
            <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-3xl p-6 sm:p-8 border-2 border-emerald-400 shadow-lg space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-100">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>SYSTEM GENERATED SOLUTION</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">
                    A feasible alternative
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    We pruned {selectedDestinations.length - result.alternativePlan.destinations.length} distant stop(s) to produce a plan that meets the selected constraints based on planning estimates.
                  </p>
                </div>

                <button
                  id="use-alternative-plan-btn"
                  onClick={() => onUseAlternativePlan(result.alternativePlan!.destinations)}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm shrink-0"
                >
                  <span>Use this plan →</span>
                </button>
              </div>

              {/* Destinations in Alternative */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {result.alternativePlan.destinations.map((dest) => (
                  <div
                    key={dest.id}
                    className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-2"
                  >
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                      <span>✓</span>
                      <span className="truncate">{dest.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatCategoryName(dest.category)} • {dest.userVisitMinutes && dest.userVisitMinutes !== getDestinationEstimatedDuration(dest)
                        ? `Planned: ${dest.userVisitMinutes}m`
                        : `Est. ${getDestinationEstimatedDuration(dest)} min visit (Planning estimate)`}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700">
                      {dest.entryCost === 0 ? 'Free entry' : `₹${dest.entryCost} entry`}
                    </div>
                  </div>
                ))}
              </div>

              {/* Alternative Stats Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Time</span>
                  <div className="text-base font-extrabold text-slate-900">
                    {formatDuration(result.alternativePlan.timeUsedMinutes)}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    Saves {formatDuration(result.alternativePlan.savedMinutes)}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Cost</span>
                  <div className="text-base font-extrabold text-slate-900">
                    {constraints.currency}{result.alternativePlan.totalCost}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    Within ₹{constraints.budget} ceiling
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Expected Return</span>
                  <div className="text-base font-extrabold text-emerald-700">
                    {result.alternativePlan.expectedReturnTime}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {result.alternativePlan.bufferMinutes}m before deadline
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  id="modify-my-trip-btn"
                  onClick={onModifyPlan}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Modify my trip manually</span>
                </button>

                <button
                  onClick={() => onUseAlternativePlan(result.alternativePlan!.destinations)}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Apply Recommended Plan & Generate Itinerary →</span>
                </button>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
