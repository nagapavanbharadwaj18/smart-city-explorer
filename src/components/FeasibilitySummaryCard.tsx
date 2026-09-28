import React from 'react';
import { Clock, Wallet, CheckCircle2, AlertTriangle, ShieldCheck, MapPin, Car } from 'lucide-react';
import { TripConstraints, FeasibilityResult } from '../types';
import { formatDuration } from '../utils/calculator';

interface FeasibilitySummaryCardProps {
  constraints: TripConstraints;
  feasibilityResult: FeasibilityResult;
  className?: string;
  showTitle?: boolean;
}

export const FeasibilitySummaryCard: React.FC<FeasibilitySummaryCardProps> = ({
  constraints,
  feasibilityResult,
  className = '',
  showTitle = true,
}) => {
  const {
    isFeasible,
    isTimeExceeded,
    isBudgetExceeded,
    totalTravelTime,
    travelTime,
    returnTravelTime,
    totalVisitTime,
    totalTripTime,
    totalDuration,
    totalTransportCost,
    totalCost,
    additionalTimeRequiredMinutes,
    overBudgetAmount,
    timeStatusMessage,
    budgetStatusMessage,
    failedConstraintExplanation,
    expectedReturnTime,
    returnDeadline,
    departureTime,
    startTimeFormatted,
  } = feasibilityResult;

  const displayStartTime = startTimeFormatted || departureTime || constraints.startTime || '--';
  const displayReturnDeadline = returnDeadline || constraints.returnDeadline || constraints.endTime || '--';
  const displayTravelTime = totalTravelTime;
  const displayTripTime = totalTripTime ?? totalDuration;

  return (
    <div
      data-testid="feasibility-summary-card"
      className={`bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm transition-all space-y-6 ${className}`}
    >
      {/* Header with Title and Feasibility Status Badge */}
      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${
                isFeasible ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <h3 className="text-sm font-extrabold text-slate-900 tracking-wider uppercase">
              Itinerary Feasibility Summary
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span
              id="feasibility-verdict-badge"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                isFeasible
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}
            >
              {isFeasible ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Itinerary Fits</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Not Feasible</span>
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Structured Feasibility Metrics as specified in Requirement 12 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Section 1: Schedule & Time Boundaries */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>Time Boundaries</span>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600">Start time:</span>
              <span id="summary-start-time" className="font-extrabold text-slate-900 text-sm">
                {displayStartTime}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600">Return deadline:</span>
              <span id="summary-return-deadline" className="font-extrabold text-slate-900 text-sm">
                {displayReturnDeadline}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Projected return:</span>
              <span className="font-bold text-slate-700">{expectedReturnTime}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Calculated Duration Breakdown (Requirements 1, 2, 3) */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Car className="w-3.5 h-3.5 text-teal-600" />
            <span>Journey Time Breakdown</span>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            {/* Total travel time = sum of every route segment */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600" title="Sum of every route segment (outbound & return)">
                Total travel time:
              </span>
              <span id="summary-total-travel-time" className="font-extrabold text-slate-900 text-sm">
                {formatDuration(displayTravelTime)}
              </span>
            </div>

            {/* Total visit time = sum of actual visit duration assigned to each destination */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600" title="Sum of destination visit durations">
                Total visit time:
              </span>
              <span id="summary-total-visit-time" className="font-extrabold text-slate-900 text-sm">
                {formatDuration(totalVisitTime)}
              </span>
            </div>

            {/* Total trip time = travel time + visit time + return travel time */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="font-bold text-slate-900">Total trip time:</span>
              <span id="summary-total-trip-time" className="font-extrabold text-emerald-800 text-sm">
                {formatDuration(displayTripTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Cost and Budget (Requirements 6 & 7) */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3 md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cost & Budget</span>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            {/* Estimated transport cost (every applicable transport segment) */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600">Estimated transport cost:</span>
              <span id="summary-transport-cost" className="font-extrabold text-slate-900 text-sm">
                {constraints.currency}{totalTransportCost ?? 0}
              </span>
            </div>

            {/* User budget */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600">User budget:</span>
              <span id="summary-user-budget" className="font-extrabold text-slate-900 text-sm">
                {constraints.currency}{constraints.budget}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Total trip cost (est.):</span>
              <span className="font-bold text-slate-800">
                {constraints.currency}{totalCost}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Requirement 12 Direct Summary Box */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 text-xs space-y-4 shadow-sm border border-slate-800">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-extrabold uppercase text-[11px] text-emerald-400 tracking-wider">
            Feasibility Summary (Requirement 12)
          </span>
          <span
            className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
              isFeasible
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {isFeasible ? '✓ Feasible' : '⚠️ Exceeded'}
          </span>
        </div>

        <div className="space-y-3">
          {/* Start time & Return deadline */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Start time:</span>
              <span className="font-bold text-slate-100">{displayStartTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Return deadline:</span>
              <span className="font-bold text-slate-100">{displayReturnDeadline}</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Travel time, Visit time, Trip time */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Total travel time:</span>
              <span className="font-bold text-slate-100">{formatDuration(displayTravelTime)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Total visit time:</span>
              <span className="font-bold text-slate-100">{formatDuration(totalVisitTime)}</span>
            </div>
            <div className="flex items-center justify-between font-bold pt-0.5">
              <span className="text-emerald-400">Total trip time:</span>
              <span className="text-emerald-300 font-extrabold text-sm">{formatDuration(displayTripTime)}</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Estimated transport cost & User budget */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Estimated transport cost:</span>
              <span className="font-bold text-slate-100">{constraints.currency}{totalTransportCost ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">User budget:</span>
              <span className="font-bold text-slate-100">{constraints.currency}{constraints.budget}</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Time status & Budget status */}
          <div className="space-y-2 pt-0.5">
            <div>
              <span className="text-slate-400 font-semibold block text-[11px] mb-0.5">Time status:</span>
              <p className={`text-xs font-bold ${isTimeExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isTimeExceeded ? (
                  <>
                    <span>This itinerary cannot be completed within your available time.</span>
                    <span className="block text-[11px] text-rose-300 font-semibold mt-0.5">
                      Additional time required: {formatDuration(additionalTimeRequiredMinutes ?? 0)} ({additionalTimeRequiredMinutes ?? 0} min).
                    </span>
                  </>
                ) : (
                  <span>This itinerary fits within your available time.</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[11px] mb-0.5">Budget status:</span>
              <p className={`text-xs font-bold ${isBudgetExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isBudgetExceeded ? (
                  <>
                    <span>This itinerary exceeds your budget.</span>
                    <span className="block text-[11px] text-rose-300 font-semibold mt-0.5">
                      Estimated amount over budget: {constraints.currency}{overBudgetAmount ?? 0}.
                    </span>
                  </>
                ) : (
                  <span>This itinerary fits within your budget.</span>
                )}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Feasibility Verdict (Requirements 13 & 14) */}
          <div className="pt-1">
            <span className="text-slate-400 font-semibold block text-[11px] mb-0.5">Verdict:</span>
            <p className={`text-xs font-bold leading-relaxed ${isFeasible ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isFeasible ? (
                'This itinerary fits.'
              ) : (
                failedConstraintExplanation ||
                (isTimeExceeded && isBudgetExceeded
                  ? `Both constraints failed: This itinerary cannot be completed within your available time (Additional time required: ${formatDuration(additionalTimeRequiredMinutes ?? 0)}), and this itinerary exceeds your budget (Estimated amount over budget: ${constraints.currency}${overBudgetAmount ?? 0}).`
                  : isTimeExceeded
                  ? `Time constraint failed: This itinerary cannot be completed within your available time. Additional time required: ${formatDuration(additionalTimeRequiredMinutes ?? 0)} (${additionalTimeRequiredMinutes ?? 0} min).`
                  : `Budget constraint failed: This itinerary exceeds your budget. Estimated amount over budget: ${constraints.currency}${overBudgetAmount ?? 0}.`)
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Feasibility Status Rows (Time Status & Budget Status) */}
      <div className="space-y-3 pt-1">
        
        {/* Time Status Row */}
        <div
          id="summary-time-status"
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition-colors ${
            isTimeExceeded
              ? 'bg-rose-50/90 border-rose-300 text-rose-950'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {isTimeExceeded ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-extrabold uppercase text-[11px] tracking-wide">
                Time status:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  isTimeExceeded ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {isTimeExceeded ? 'Exceeded' : 'Fits'}
              </span>
            </div>
            <p className="font-bold leading-relaxed">
              {isTimeExceeded ? (
                <>
                  <span className="text-rose-900">
                    This itinerary cannot be completed within your available time.
                  </span>
                  {' '}
                  <span className="text-rose-700 font-semibold">
                    Additional time required: {formatDuration(additionalTimeRequiredMinutes ?? 0)} ({additionalTimeRequiredMinutes ?? 0} min).
                  </span>
                </>
              ) : (
                timeStatusMessage || 'This itinerary fits within your available time window.'
              )}
            </p>
          </div>
        </div>

        {/* Budget Status Row */}
        <div
          id="summary-budget-status"
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition-colors ${
            isBudgetExceeded
              ? 'bg-rose-50/90 border-rose-300 text-rose-950'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {isBudgetExceeded ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-extrabold uppercase text-[11px] tracking-wide">
                Budget status:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  isBudgetExceeded ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {isBudgetExceeded ? 'Exceeded' : 'Within Budget'}
              </span>
            </div>
            <p className="font-bold leading-relaxed">
              {isBudgetExceeded ? (
                <>
                  <span className="text-rose-900">This itinerary exceeds your budget.</span>
                  {' '}
                  <span className="text-rose-700 font-semibold">
                    Estimated amount over budget: {constraints.currency}{overBudgetAmount ?? 0} (Total cost: {constraints.currency}{totalCost} vs Budget: {constraints.currency}{constraints.budget}).
                  </span>
                </>
              ) : (
                budgetStatusMessage || `Within budget (${constraints.currency}${feasibilityResult.remainingBudget} remaining).`
              )}
            </p>
          </div>
        </div>

      </div>

      {/* Section 5: Feasibility Verdict (Requirements 13 & 14) */}
      <div
        id="summary-feasibility-verdict"
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isFeasible
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-amber-50/90 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {isFeasible ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="font-extrabold text-xs uppercase tracking-wide flex items-center justify-between">
              <span>
                {isFeasible ? 'Feasibility Verdict: Itinerary Fits' : 'Feasibility Verdict: Constraint Failed'}
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${isFeasible ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                {isFeasible ? 'VALIDATED' : 'ACTION REQUIRED'}
              </span>
            </div>

            <p className="text-xs leading-relaxed font-medium">
              {isFeasible ? (
                <span className="text-emerald-900 font-semibold">
                  This itinerary fits. All selected destination visits, route segments, and the return journey can be completed within your available time and budget.
                </span>
              ) : (
                <span className="text-amber-950 font-semibold">
                  {failedConstraintExplanation ||
                    (isTimeExceeded && isBudgetExceeded
                      ? `Both constraints failed: This itinerary cannot be completed within your available time (Additional time required: ${formatDuration(additionalTimeRequiredMinutes ?? 0)}), and this itinerary exceeds your budget (Estimated amount over budget: ${constraints.currency}${overBudgetAmount ?? 0}).`
                      : isTimeExceeded
                      ? `Time constraint failed: This itinerary cannot be completed within your available time. Additional time required: ${formatDuration(additionalTimeRequiredMinutes ?? 0)} (${additionalTimeRequiredMinutes ?? 0} min).`
                      : `Budget constraint failed: This itinerary exceeds your budget. Estimated amount over budget: ${constraints.currency}${overBudgetAmount ?? 0}.`)}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
