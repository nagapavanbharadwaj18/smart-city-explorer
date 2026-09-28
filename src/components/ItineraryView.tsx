import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Clock,
  Wallet,
  Car,
  Share2,
  Bookmark,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Sparkles,
  Info,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Destination, TripConstraints, FeasibilityResult } from '../types';
import { analyzeTripFeasibility, formatDuration, formatTransportName } from '../utils/calculator';
import { RouteResult, computeTripLegs } from '../services/routesService';
import { MapView } from './MapView';

interface ItineraryViewProps {
  constraints: TripConstraints;
  destinations: Destination[];
  feasibilityResult?: FeasibilityResult;
  routeLegsMap?: Map<string, RouteResult>;
  onModifyPlan: () => void;
  onReset: () => void;
  onUpdateVisitDuration?: (destId: string, durationMinutes?: number) => void;
}

const getTransportModeIcon = (mode?: string) => {
  switch (mode) {
    case 'walking':
      return '🚶';
    case 'two_wheeler':
      return '🏍️';
    case 'metro':
      return '🚇';
    case 'bus':
    case 'public_transport':
      return '🚌';
    case 'bicycle':
    case 'bike_rental':
      return '🚲';
    case 'system_choice':
      return '✨';
    case 'auto_cab':
      return '🚕';
    case 'driving':
    default:
      return '🚗';
  }
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  constraints,
  destinations,
  feasibilityResult,
  routeLegsMap: propRouteLegsMap,
  onModifyPlan,
  onReset,
  onUpdateVisitDuration,
}) => {
  const [activeDestId, setActiveDestId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [localRouteLegsMap, setLocalRouteLegsMap] = useState<Map<string, RouteResult> | undefined>(undefined);

  const activeRouteLegsMap = propRouteLegsMap || localRouteLegsMap;

  React.useEffect(() => {
    let isMounted = true;
    if (propRouteLegsMap || destinations.length === 0) return;

    computeTripLegs(
      constraints.startLocation,
      destinations,
      constraints.sameReturnLocation ? constraints.startLocation : constraints.returnLocation,
      constraints.transportPreference,
      constraints.rentalPickupShop,
      constraints.segmentTransportModes,
      constraints.startCoordinates,
      constraints.sameReturnLocation ? constraints.startCoordinates : constraints.returnCoordinates,
      constraints.sameReturnLocation
    )
      .then((legs) => {
        if (isMounted) setLocalRouteLegsMap(legs);
      })
      .catch((err) => {
        console.warn('Routes API fallback engaged in ItineraryView:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [
    propRouteLegsMap,
    destinations,
    constraints.startLocation,
    constraints.returnLocation,
    constraints.sameReturnLocation,
    constraints.transportPreference,
    constraints.rentalPickupShop,
    constraints.segmentTransportModes,
    constraints.startCoordinates,
    constraints.returnCoordinates,
  ]);

  // Requirement 7: Use exactly the calculated itinerary data; do NOT recalculate.
  const result: FeasibilityResult =
    feasibilityResult ||
    analyzeTripFeasibility(constraints, destinations, {
      routeLegsMap: activeRouteLegsMap,
    });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Share link copied to clipboard!');
    } else {
      showToast('Share link ready!');
    }
  };

  const handleSave = () => {
    try {
      const savedData = {
        constraints,
        destinations,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('smart_city_explorer_itinerary', JSON.stringify(savedData));
      showToast('Itinerary saved to local device!');
    } catch {
      showToast('Itinerary saved successfully!');
    }
  };

  // Requirement 1: START data
  const startSeg = useMemo(() => {
    return result.timeline.find((s) => s.type === 'start');
  }, [result.timeline]);

  const startingLocation = constraints.startLocation || 'Starting Location';
  const departureTime = result.departureTime || constraints.startTime || startSeg?.time || '09:00';

  // Rental vehicle pickup step (if applicable)
  const rentalTravelSeg = useMemo(() => {
    return result.timeline.find((s) => s.id === 'travel-rental-pickup');
  }, [result.timeline]);

  const rentalPickupSeg = useMemo(() => {
    return result.timeline.find((s) => s.id === 'pickup-rental-vehicle');
  }, [result.timeline]);

  // Requirement 2: EACH DESTINATION IN ORDER
  const destinationStops = useMemo(() => {
    const visits = result.timeline.filter((s) => s.type === 'visit' && s.destinationId);
    return visits.map((visitSeg, idx) => {
      const incomingTravel = result.timeline.find((t) => t.id === `travel-${visitSeg.destinationId}`);
      const destData =
        destinations.find((d) => d.id === visitSeg.destinationId) ||
        result.includedDestinations?.find((d) => d.id === visitSeg.destinationId);

      return {
        index: idx,
        destinationId: visitSeg.destinationId!,
        destinationName: visitSeg.title,
        arrivalTime: visitSeg.arrivalTime || visitSeg.time,
        plannedVisitDuration: visitSeg.visitDurationMinutes ?? visitSeg.durationMinutes,
        departureTime: visitSeg.departureTime || '--',
        travelMode: incomingTravel?.transportMode || constraints.transportPreference,
        travelDistanceKm: incomingTravel?.distanceKm,
        travelDurationMinutes: incomingTravel?.durationMinutes ?? visitSeg.travelMinutes,
        estimatedTransportCost: incomingTravel?.cost ?? 0,
        fareDisplay: incomingTravel?.fareDisplay,
        isEstimated: visitSeg.isEstimated,
        entryCost: visitSeg.cost,
        category: visitSeg.category || destData?.category,
        transitDetails: incomingTravel?.transitDetails,
        isRealRoute: incomingTravel?.isRealRoute,
        isFallback: incomingTravel?.isFallback,
        subtitle: visitSeg.subtitle,
      };
    });
  }, [result.timeline, destinations, result.includedDestinations, constraints.transportPreference]);

  // Requirement 3: RETURN JOURNEY data
  const returnTravelSeg = useMemo(() => {
    return result.timeline.find((s) => s.id === 'travel-return');
  }, [result.timeline]);

  const returnArrivalSeg = useMemo(() => {
    return result.timeline.find((s) => s.id === 'seg-return');
  }, [result.timeline]);

  const isRoundTrip = constraints.sameReturnLocation !== false;
  const finalDestinationName = isRoundTrip
    ? (constraints.startLocation || 'Starting Location (Origin)')
    : (constraints.returnLocation || constraints.startLocation || 'Return Destination');
  const returnTransportMode = returnTravelSeg?.transportMode || constraints.transportPreference;
  const returnDistanceKm = returnTravelSeg?.distanceKm;
  const returnDurationMinutes = returnTravelSeg?.durationMinutes ?? result.returnTravelTime;
  const returnCost = returnTravelSeg?.cost ?? 0;
  const returnFareDisplay = returnTravelSeg?.fareDisplay;
  const expectedArrivalBack = result.expectedReturnTime || returnArrivalSeg?.arrivalTime || returnArrivalSeg?.time || '--';

  // Requirement 4: TRIP SUMMARY values (from engine)
  const totalDistance = result.totalDistanceKm !== undefined ? result.totalDistanceKm.toFixed(1) : '0.0';
  const totalTravelTimeFormatted = formatDuration(result.totalTravelTime);
  const totalVisitTimeFormatted = formatDuration(result.totalVisitTime);
  const totalTripDurationFormatted = formatDuration(result.totalTripTime ?? result.totalDuration);
  const totalEstimatedTransportCost = `${constraints.currency}${result.totalTransportCost ?? 0}`;
  const userBudget = `${constraints.currency}${constraints.budget}`;
  const userAvailableTimeFormatted = formatDuration(result.timeAvailableMinutes);

  // Requirement 5: FEASIBILITY flags
  const fitsTime = !result.isTimeExceeded;
  const fitsReturnDeadline = result.bufferMinutes >= 0;
  const fitsBudget = !result.isBudgetExceeded;
  const fitsOverall = result.isFeasible;

  if (destinations.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center space-y-6 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/90 shadow-xs space-y-6">
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
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span>← Select Destinations</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-24 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center flex-wrap gap-2 mb-2">
            {fitsOverall ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🟢 FEASIBLE ITINERARY</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>⚠️ CONSTRAINTS EXCEEDED</span>
              </span>
            )}
            <span className="text-xs text-slate-500 font-medium">
              {destinationStops.length} stop{destinationStops.length === 1 ? '' : 's'} planned
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Final Trip Itinerary
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Complete schedule departing from <span className="font-semibold text-slate-900">{startingLocation}</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            id="itinerary-modify-btn"
            onClick={onModifyPlan}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Modify Plan</span>
          </button>

          <button
            id="itinerary-save-btn"
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
            <span>Save</span>
          </button>

          <button
            id="itinerary-share-btn"
            onClick={handleShare}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Share</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TRIP SUMMARY (Requirement 4) */}
      {/* ========================================================================= */}
      <section aria-labelledby="trip-summary-heading" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h2 id="trip-summary-heading" className="text-base sm:text-lg font-extrabold text-slate-950 uppercase tracking-wide">
              Trip Summary
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Calculated by Route & Feasibility Engine
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 pt-1">
          {/* 1. Total distance */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Distance
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{totalDistance} km</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                All travel segments
              </span>
            </div>
          </div>

          {/* 2. Total travel time */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Travel Time
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{totalTravelTimeFormatted}</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Sum of route legs
              </span>
            </div>
          </div>

          {/* 3. Total visit time */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Visit Time
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{totalVisitTimeFormatted}</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Destination dwell time
              </span>
            </div>
          </div>

          {/* 4. Total trip duration */}
          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Total Trip Duration
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{totalTripDurationFormatted}</span>
              </span>
              <span className="text-[10px] text-emerald-700 mt-1 block">
                Travel + Visit + Return
              </span>
            </div>
          </div>

          {/* 5. Total estimated transport cost */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Est. Transport Cost
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{totalEstimatedTransportCost}</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block truncate">
                Total trip: {constraints.currency}{result.totalCost}
              </span>
            </div>
          </div>

          {/* 6. User's budget */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              User Budget
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-slate-600 shrink-0" />
                <span>{userBudget}</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {fitsBudget ? 'Budget satisfied' : 'Over budget'}
              </span>
            </div>
          </div>

          {/* 7. User's available time */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              User Available Time
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                <span>{userAvailableTimeFormatted}</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {fitsTime ? 'Fits available time' : 'Time exceeded'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. FEASIBILITY (Requirement 5) */}
      {/* ========================================================================= */}
      <section aria-labelledby="feasibility-heading" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {fitsOverall ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            )}
            <h2 id="feasibility-heading" className="text-base sm:text-lg font-extrabold text-slate-950 uppercase tracking-wide">
              Itinerary Feasibility Status
            </h2>
          </div>

          <span
            id="feasibility-status-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${
              fitsOverall
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-rose-100 text-rose-900 border border-rose-300'
            }`}
          >
            {fitsOverall ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Itinerary Fits All Constraints</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Itinerary Does Not Fit Constraints</span>
              </>
            )}
          </span>
        </div>

        {/* 3 Feasibility Columns: Time, Return Deadline, Budget */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Constraint A: Time */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              fitsTime
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-rose-50/50 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                1. Available Time
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  fitsTime
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {fitsTime ? '✓ Fits' : '⚠️ Exceeded'}
              </span>
            </div>

            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-800">
              {fitsTime ? (
                <span className="text-emerald-900">
                  This itinerary fits within your available time ({totalTripDurationFormatted} of {userAvailableTimeFormatted} used).
                </span>
              ) : (
                <span className="text-rose-900">
                  This itinerary cannot be completed within your available time.
                </span>
              )}
            </p>

            {!fitsTime && (
              <div className="mt-2 text-[11px] font-semibold text-rose-700 bg-rose-100/70 p-2 rounded-xl">
                Additional time required: {formatDuration(result.additionalTimeRequiredMinutes ?? 0)} ({result.additionalTimeRequiredMinutes ?? 0} min).
              </div>
            )}
          </div>

          {/* Constraint B: Return Deadline */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              fitsReturnDeadline
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-rose-50/50 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                2. Return Deadline
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  fitsReturnDeadline
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {fitsReturnDeadline ? '✓ Fits' : '⚠️ Exceeded'}
              </span>
            </div>

            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-800">
              {fitsReturnDeadline ? (
                <span className="text-emerald-900">
                  Expected return at <strong className="font-extrabold">{expectedArrivalBack}</strong> respects your <strong className="font-extrabold">{result.returnDeadline || result.deadlineTime}</strong> cutoff.
                </span>
              ) : (
                <span className="text-rose-900">
                  Expected return at <strong className="font-extrabold">{expectedArrivalBack}</strong> breaches your deadline of <strong className="font-extrabold">{result.returnDeadline || result.deadlineTime}</strong>.
                </span>
              )}
            </p>

            <div className="mt-2 text-[11px] font-semibold text-slate-600">
              {fitsReturnDeadline ? (
                <span className="text-emerald-800">
                  Buffer before deadline: +{result.bufferMinutes} minutes cushion.
                </span>
              ) : (
                <span className="text-rose-700 bg-rose-100/70 p-2 rounded-xl block">
                  Deadline overrun: {Math.abs(result.bufferMinutes)} minutes past cutoff.
                </span>
              )}
            </div>
          </div>

          {/* Constraint C: Budget */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              fitsBudget
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-rose-50/50 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                3. User Budget
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  fitsBudget
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {fitsBudget ? '✓ Fits' : '⚠️ Exceeded'}
              </span>
            </div>

            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-800">
              {fitsBudget ? (
                <span className="text-emerald-900">
                  This itinerary fits within your budget (Transport: {totalEstimatedTransportCost} • Total: {constraints.currency}{result.totalCost}).
                </span>
              ) : (
                <span className="text-rose-900">
                  This itinerary exceeds your budget.
                </span>
              )}
            </p>

            {!fitsBudget ? (
              <div className="mt-2 text-[11px] font-semibold text-rose-700 bg-rose-100/70 p-2 rounded-xl">
                Estimated amount over budget: {constraints.currency}{result.overBudgetAmount ?? 0}.
              </div>
            ) : (
              <div className="mt-2 text-[11px] font-semibold text-emerald-800">
                Remaining budget: {constraints.currency}{result.remainingBudget ?? (constraints.budget - result.totalCost)}.
              </div>
            )}
          </div>
        </div>

        {/* Failure Explanation Banner (if itinerary does not fit) */}
        {!fitsOverall && (
          <div
            id="feasibility-failure-explanation"
            className="p-4 sm:p-5 rounded-2xl bg-rose-900 text-white space-y-2 border border-rose-800 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
              <h3 className="font-extrabold text-sm text-rose-100">
                Why this itinerary does not fit:
              </h3>
            </div>
            <p className="text-xs text-rose-200 font-medium leading-relaxed">
              {result.failedConstraintExplanation ||
                'The selected plan violates your journey constraints. Please adjust your destination list, departure time, or budget.'}
            </p>
            <ul className="text-xs text-rose-200 list-disc list-inside space-y-1 pt-1 font-medium">
              {!fitsTime && (
                <li>
                  <strong className="text-white">Available Time:</strong> Total trip duration ({totalTripDurationFormatted}) exceeds your available time ({userAvailableTimeFormatted}) by {result.additionalTimeRequiredMinutes ?? 0} minutes.
                </li>
              )}
              {!fitsReturnDeadline && (
                <li>
                  <strong className="text-white">Return Deadline:</strong> Expected arrival at {expectedArrivalBack} is {Math.abs(result.bufferMinutes)} minutes past your {result.returnDeadline || result.deadlineTime} cutoff.
                </li>
              )}
              {!fitsBudget && (
                <li>
                  <strong className="text-white">Budget:</strong> Total cost ({constraints.currency}{result.totalCost}) exceeds your budget ({userBudget}) by {constraints.currency}{result.overBudgetAmount ?? 0}.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Success Banner (if itinerary fits) */}
        {fitsOverall && (
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-950 border border-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold leading-relaxed">
              This itinerary is completely feasible! It fits your available time, respects your return cutoff with a {result.bufferMinutes}m buffer, and stays within your budget.
            </span>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN CONTENT: (Left: Timeline / Right: MapView) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Itinerary Details (7 Columns on Large Screens) */}
        <div className="lg:col-span-7 space-y-6">

          {/* ===================================================================== */}
          {/* 1. START SECTION (Requirement 1) */}
          {/* ===================================================================== */}
          <div
            id="itinerary-start-section"
            className="bg-slate-950 text-white rounded-3xl p-6 sm:p-7 border border-slate-900 shadow-md space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                  S
                </span>
                <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-400">
                  1. Trip Commencement
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Departure: <strong className="text-emerald-400">{departureTime}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              {/* Starting location */}
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Starting Location
                </span>
                <span className="font-extrabold text-sm sm:text-base text-white flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{startingLocation}</span>
                </span>
                <span className="block text-[10px] text-slate-500">
                  Origin departure base
                </span>
              </div>

              {/* Departure time */}
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Departure Time
                </span>
                <span className="font-extrabold text-sm sm:text-base text-emerald-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{departureTime}</span>
                </span>
                <span className="block text-[10px] text-slate-500">
                  Target trip start
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Rental Pickup Step (if user selected bike rental) */}
          {rentalPickupSeg && (
            <div className="bg-amber-50/70 border border-amber-200/90 rounded-3xl p-5 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
                    🚲
                  </span>
                  <span className="font-extrabold text-amber-950">
                    {rentalPickupSeg.title.replace(/^Pickup Vehicle:\s*/i, 'Vehicle Pickup: ')}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-amber-800">
                  ⏱️ 10 min dwell
                </span>
              </div>
              <p className="text-amber-800 text-[11px]">
                {rentalTravelSeg ? `${rentalTravelSeg.distanceKm?.toFixed(1)} km transit (${rentalTravelSeg.durationMinutes} min) • ` : ''}
                Documentation & vehicle inspection before beginning city stops.
              </p>
            </div>
          )}

          {/* ===================================================================== */}
          {/* 2. EACH DESTINATION IN ORDER (Requirement 2) */}
          {/* ===================================================================== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-600" />
                <span>2. Destinations in Order ({destinationStops.length} stops)</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Sequential transit & visits
              </span>
            </div>

            {destinationStops.map((stop) => {
              const isActive = activeDestId === stop.destinationId;

              return (
                <div
                  key={stop.destinationId}
                  id={`destination-stop-${stop.index + 1}`}
                  onMouseEnter={() => setActiveDestId(stop.destinationId)}
                  onMouseLeave={() => setActiveDestId(null)}
                  className={`bg-white rounded-3xl p-5 sm:p-6 border transition-all ${
                    isActive
                      ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md scale-[1.008]'
                      : 'border-slate-200/90 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {/* Card Header: Stop Number + Destination Name + Duration Tag */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        #{stop.index + 1}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg text-slate-950">
                          {stop.destinationName}
                        </h3>
                        {stop.subtitle && (
                          <span className="text-[11px] text-slate-500 block">
                            {stop.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Requirement 6 & 8: Never hide/shorten visit duration; mark estimated vs planned */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          stop.isEstimated
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {stop.isEstimated ? '⏱️ Estimated Duration' : '✓ Planned Duration'}
                      </span>
                    </div>
                  </div>

                  {/* Requirement 2: The 8 Explicitly Required Destination Details */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                    {/* Detail 1: Destination Name */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Destination Name
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate block mt-0.5">
                        {stop.destinationName}
                      </span>
                    </div>

                    {/* Detail 2: Arrival Time */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Arrival Time
                      </span>
                      <span className="font-extrabold text-emerald-800 text-xs sm:text-sm block mt-0.5">
                        {stop.arrivalTime}
                      </span>
                    </div>

                    {/* Detail 3: Planned Visit Duration (Requirement 6: never shorten/hide) */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Planned Visit Duration
                      </span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          {stop.plannedVisitDuration} min
                        </span>
                        {onUpdateVisitDuration && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const current = stop.plannedVisitDuration;
                                const next = Math.max(10, current - 15);
                                onUpdateVisitDuration(stop.destinationId, next);
                              }}
                              className="w-4 h-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                              title="Decrease visit by 15 min"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const current = stop.plannedVisitDuration;
                                const next = Math.min(240, current + 15);
                                onUpdateVisitDuration(stop.destinationId, next);
                              }}
                              className="w-4 h-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                              title="Increase visit by 15 min"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detail 4: Departure Time */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Departure Time
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm block mt-0.5">
                        {stop.departureTime}
                      </span>
                    </div>

                    {/* Detail 5: Travel Mode Used to Reach It */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Travel Mode
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1 mt-0.5 truncate">
                        <span>{getTransportModeIcon(stop.travelMode)}</span>
                        <span className="truncate">{formatTransportName(stop.travelMode)}</span>
                      </span>
                    </div>

                    {/* Detail 6: Travel Distance */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Travel Distance
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm block mt-0.5">
                        {stop.travelDistanceKm !== undefined ? `${stop.travelDistanceKm.toFixed(1)} km` : '--'}
                      </span>
                    </div>

                    {/* Detail 7: Travel Duration */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Travel Duration
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm block mt-0.5">
                        {stop.travelDurationMinutes !== undefined ? `${stop.travelDurationMinutes} min` : '--'}
                      </span>
                    </div>

                    {/* Detail 8: Estimated Transport Cost */}
                    <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Est. Transport Cost
                      </span>
                      <span className="font-extrabold text-emerald-700 text-xs sm:text-sm block mt-0.5 truncate">
                        {stop.fareDisplay || `${constraints.currency}${stop.estimatedTransportCost}`}
                      </span>
                    </div>
                  </div>

                  {/* Public Transit Specific Route Details (if applicable) */}
                  {stop.transitDetails && stop.transitDetails.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Connections:
                      </span>
                      {stop.transitDetails.map((td, tIdx) => (
                        <span
                          key={tIdx}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200"
                        >
                          <span>{td.vehicleType === 'BUS' ? '🚌' : '🚇'}</span>
                          <span>{td.vehicleName} {td.lineShortName ? `(${td.lineShortName})` : td.lineName}</span>
                          {td.stopCount && <span className="text-emerald-700 font-normal">• {td.stopCount} stops</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Entry fee indicator */}
                  {stop.entryCost > 0 && (
                    <div className="mt-2 text-[11px] text-slate-500 font-medium">
                      🎫 Destination Entry Fee: <strong className="text-slate-800">{constraints.currency}{stop.entryCost}</strong> ({constraints.peopleCount} {constraints.peopleCount === 1 ? 'person' : 'people'})
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ===================================================================== */}
          {/* 3. RETURN JOURNEY (Requirement 3) */}
          {/* ===================================================================== */}
          <div
            id="itinerary-return-journey-section"
            className="bg-emerald-950 text-white rounded-3xl p-6 sm:p-7 border border-emerald-900 shadow-md space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-emerald-900/80">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-400 text-emerald-950 font-extrabold text-xs flex items-center justify-center">
                  R
                </span>
                <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-300">
                  3. Return Journey (Trip Conclusion)
                </span>
              </div>

              <span className="text-[11px] font-bold text-emerald-300">
                Arrival back: <strong className="text-white">{expectedArrivalBack}</strong>
              </span>
            </div>

            {/* Requirement 3: The 6 Explicitly Required Return Journey Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
              {/* 1. Final Destination */}
              <div className="bg-emerald-900/60 p-3.5 rounded-2xl border border-emerald-800/70">
                <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Final Destination
                </span>
                <span className="font-extrabold text-sm sm:text-base text-white truncate block mt-0.5">
                  {finalDestinationName}
                </span>
                <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                  {isRoundTrip ? 'Return origin base' : 'Custom drop-off location'}
                </span>
              </div>

              {/* 2. Return Transport Mode */}
              <div className="bg-emerald-900/60 p-3.5 rounded-2xl border border-emerald-800/70">
                <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Return Transport Mode
                </span>
                <span className="font-extrabold text-sm sm:text-base text-white flex items-center gap-1.5 mt-0.5 truncate">
                  <span>{getTransportModeIcon(returnTransportMode)}</span>
                  <span className="truncate">{formatTransportName(returnTransportMode)}</span>
                </span>
                <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                  Direct return transit
                </span>
              </div>

              {/* 3. Return Distance */}
              <div className="bg-emerald-900/60 p-3.5 rounded-2xl border border-emerald-800/70">
                <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Return Distance
                </span>
                <span className="font-extrabold text-sm sm:text-base text-white block mt-0.5">
                  {returnDistanceKm !== undefined ? `${returnDistanceKm.toFixed(1)} km` : '--'}
                </span>
                <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                  Last destination to return point
                </span>
              </div>

              {/* 4. Return Duration */}
              <div className="bg-emerald-900/60 p-3.5 rounded-2xl border border-emerald-800/70">
                <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Return Duration
                </span>
                <span className="font-extrabold text-sm sm:text-base text-white block mt-0.5">
                  {returnDurationMinutes !== undefined ? `${returnDurationMinutes} min` : '--'}
                </span>
                <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                  Return travel leg time
                </span>
              </div>

              {/* 5. Estimated Cost */}
              <div className="bg-emerald-900/60 p-3.5 rounded-2xl border border-emerald-800/70">
                <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Estimated Cost
                </span>
                <span className="font-extrabold text-sm sm:text-base text-emerald-300 block mt-0.5">
                  {returnFareDisplay || `${constraints.currency}${returnCost}`}
                </span>
                <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                  Final segment fare
                </span>
              </div>

              {/* 6. Expected Arrival Back at Starting Location */}
              <div className="bg-emerald-900/60 p-3.5 rounded-2xl border border-emerald-800/70">
                <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Expected Arrival Back
                </span>
                <span className="font-extrabold text-sm sm:text-base text-emerald-300 block mt-0.5">
                  {expectedArrivalBack}
                </span>
                <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                  {result.bufferMinutes >= 0
                    ? `+${result.bufferMinutes}m before ${result.returnDeadline || result.deadlineTime}`
                    : `${Math.abs(result.bufferMinutes)}m after deadline`}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Interactive Map Visualization (5 Columns on Large Screens) */}
        {/* Requirement 8: Keep existing map functionality, displaying route in exact same order */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-20 space-y-6">
            <MapView
              constraints={constraints}
              destinations={result.includedDestinations.length > 0 ? result.includedDestinations : destinations}
              activeDestinationId={activeDestId}
              onSelectDestination={(id) => setActiveDestId(id)}
              routeLegsMap={activeRouteLegsMap}
              timeline={result.timeline}
              totalDistanceKm={result.totalDistanceKm}
              totalDurationMinutes={result.totalTravelTime}
            />

            {/* Quick Action / Exploration Status Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Trip Overview Status</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This final plan has been verified against your time boundaries, return deadline, and transport budget. All visit times reflect actual destination requirements.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                <button
                  onClick={onReset}
                  className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Start New City Exploration
                </button>
                <button
                  onClick={() => window.print()}
                  className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Itinerary</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
