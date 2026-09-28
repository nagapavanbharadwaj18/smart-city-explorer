import React, { useState } from 'react';
import { Clock, Wallet, MapPin, Car, AlertTriangle, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Destination, TripConstraints, FeasibilityResult } from '../types';
import { RouteResult } from '../services/routesService';
import { analyzeTripFeasibility, formatDuration, formatTransportName } from '../utils/calculator';

interface TripSummaryPanelProps {
  constraints: TripConstraints;
  destinations: Destination[];
  feasibilityResult?: FeasibilityResult;
  routeLegsMap?: Map<string, RouteResult>;
  onCheckPlan?: () => void;
}

export const TripSummaryPanel: React.FC<TripSummaryPanelProps> = ({
  constraints,
  destinations,
  feasibilityResult,
  routeLegsMap,
  onCheckPlan,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (destinations.length === 0) return null;

  const result = feasibilityResult || analyzeTripFeasibility(constraints, destinations, { routeLegsMap });

  // When moved aside / collapsed, show a non-intrusive compact pill positioned safely above the bottom bar
  if (!isExpanded) {
    return (
      <div className="fixed bottom-24 right-4 z-40 flex items-center shadow-lg rounded-full">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="bg-slate-900/95 hover:bg-slate-900 text-white pl-3.5 pr-4 py-2 rounded-full border border-slate-700/80 flex items-center gap-2.5 text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-xl backdrop-blur-md"
          aria-label="Expand Trip Constraint Summary"
        >
          {result.isFeasible ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          )}
          <span className="tracking-wide">Trip Constraint Summary</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
              result.isFeasible
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {result.isFeasible ? '✓ Feasible' : '⚠️ Exceeded'}
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Trip Constraint Summary"
      className="fixed bottom-24 right-4 z-40 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden transition-all text-xs"
    >
      {/* Header Bar with explicit Move Aside button */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between select-none">
        <div
          onClick={() => setIsExpanded(false)}
          className="flex items-center gap-2 cursor-pointer"
        >
          {result.isFeasible ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          )}
          <span className="font-extrabold tracking-wide text-xs">
            Trip Constraint Summary
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              result.isFeasible
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {result.isFeasible ? '✓ Feasible' : '⚠️ Exceeded'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
          title="Move aside"
          aria-label="Move aside"
        >
          <span>Move aside</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Requirement 12: Clear Summary Grid */}
          <div className="space-y-2 text-[11px]">
            {/* Time Boundaries */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Start time:</span>
                <span className="font-extrabold text-slate-900">{constraints.startTime || result.departureTime || '--'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Return deadline:</span>
                <span className="font-extrabold text-slate-900">{result.returnDeadline || constraints.returnDeadline || constraints.endTime || '--'}</span>
              </div>
            </div>

            {/* Travel, Visit, and Trip Times */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Total travel time:</span>
                <span className="font-extrabold text-slate-900">{formatDuration(result.totalTravelTime)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Total visit time:</span>
                <span className="font-extrabold text-slate-900">{formatDuration(result.totalVisitTime)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-bold">
                <span className="text-slate-800">Total trip time:</span>
                <span className="text-emerald-800 font-extrabold">{formatDuration(result.totalTripTime ?? result.totalDuration)}</span>
              </div>
            </div>

            {/* Transport Cost and Budget */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Estimated transport cost:</span>
                <span className="font-extrabold text-slate-900">{constraints.currency}{result.totalTransportCost ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">User budget:</span>
                <span className="font-extrabold text-slate-900">{constraints.currency}{constraints.budget}</span>
              </div>
            </div>

            {/* Time and Budget Status */}
            <div className="space-y-1 pt-1">
              <div className={`p-2 rounded-lg border text-[10px] ${result.isTimeExceeded ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <span className="font-extrabold block">Time status:</span>
                <span className="font-semibold leading-tight block">
                  {result.isTimeExceeded
                    ? `This itinerary cannot be completed within your available time. Additional time required: ${formatDuration(result.additionalTimeRequiredMinutes ?? 0)}.`
                    : 'Fits within available time.'}
                </span>
              </div>

              <div className={`p-2 rounded-lg border text-[10px] ${result.isBudgetExceeded ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <span className="font-extrabold block">Budget status:</span>
                <span className="font-semibold leading-tight block">
                  {result.isBudgetExceeded
                    ? `This itinerary exceeds your budget. Amount over budget: ${constraints.currency}${result.overBudgetAmount ?? 0}.`
                    : 'Within budget.'}
                </span>
              </div>
            </div>
          </div>

          {/* Transport Row */}
          <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <Car className="w-3.5 h-3.5 text-teal-600" />
              <span>{formatTransportName(constraints.transportPreference)}</span>
            </span>

            {onCheckPlan && (
              <button
                onClick={onCheckPlan}
                className="font-bold text-emerald-700 hover:text-emerald-800"
              >
                Choose Transport →
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
