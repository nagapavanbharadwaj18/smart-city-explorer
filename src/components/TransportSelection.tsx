import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Bike,
  Footprints,
  Bus,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  MapPin,
  Clock,
  Compass,
} from 'lucide-react';
import { TripConstraints, Destination, TransportMode } from '../types';
import {
  analyzeJourneySegments,
  TripSegmentAnalysis,
  TransportOptionInfo,
  JourneySegment,
} from '../services/transportSegmentService';
import { NearbyBikeRentals } from './NearbyBikeRentals';
import { RentalBusiness } from '../services/rentalService';
import { formatTransportName } from '../feasibility';

interface TransportSelectionProps {
  constraints: TripConstraints;
  destinations: Destination[];
  onChangeConstraints: (constraints: TripConstraints) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const TransportSelection: React.FC<TransportSelectionProps> = ({
  constraints,
  destinations,
  onChangeConstraints,
  onProceed,
  onBack,
}) => {
  const [analysis, setAnalysis] = useState<TripSegmentAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [wantsRentalBike, setWantsRentalBike] = useState<boolean>(
    Boolean(constraints.wantsRentedBike || constraints.rentalPickupShop)
  );
  const [selectedRentalShop, setSelectedRentalShop] = useState<RentalBusiness | null>(
    constraints.rentalPickupShop
      ? {
          placeId: constraints.rentalPickupShop.placeId,
          name: constraints.rentalPickupShop.name,
          address: constraints.rentalPickupShop.address,
          latitude: constraints.rentalPickupShop.latitude,
          longitude: constraints.rentalPickupShop.longitude,
          distanceKm: constraints.rentalPickupShop.distanceKm,
          estimatedTravelMinutes: constraints.rentalPickupShop.estimatedTravelMinutes || 10,
          estimatedTravelTimeFormatted: constraints.rentalPickupShop.estimatedTravelTimeFormatted || '~10 min travel',
          rating: constraints.rentalPickupShop.rating,
          userRatingsTotal: constraints.rentalPickupShop.userRatingsTotal,
          phoneNumber: constraints.rentalPickupShop.phoneNumber,
          website: constraints.rentalPickupShop.website,
          openNow: constraints.rentalPickupShop.openNow,
          openingStatusText: constraints.rentalPickupShop.openingStatusText,
          regularOpeningHours: constraints.rentalPickupShop.regularOpeningHours,
          rentalPriceInfo: constraints.rentalPickupShop.rentalPriceInfo || 'Rental price unavailable — check with the business.',
        }
      : null
  );

  const hasStartLocation = Boolean(constraints.startLocation?.trim());
  const hasDestinations = destinations.length > 0;

  // Fetch real routes for each journey segment independently
  useEffect(() => {
    if (!hasStartLocation || !hasDestinations) {
      setAnalysis(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const returnLoc = constraints.sameReturnLocation
      ? constraints.startLocation
      : constraints.returnLocation || constraints.startLocation;

    analyzeJourneySegments(
      constraints.startLocation,
      destinations,
      returnLoc,
      constraints.startCoordinates,
      constraints.returnCoordinates,
      constraints.sameReturnLocation,
      constraints.startTime,
      constraints.segmentTransportModes
    )
      .then((res) => {
        if (!isMounted) return;
        setAnalysis(res);
        setIsLoading(false);

        // Auto-initialize segment transport modes with their recommended option
        // (e.g. Walking is automatically defaulted for genuinely short distances <= 2km)
        const currentModes = constraints.segmentTransportModes || {};
        let hasNewDefaults = false;
        const initialModes: Record<string, TransportMode> = { ...currentModes };

        res.segments.forEach((seg) => {
          if (!initialModes[seg.id]) {
            initialModes[seg.id] = seg.selectedMode;
            hasNewDefaults = true;
          }
        });

        if (hasNewDefaults) {
          onChangeConstraints({
            ...constraints,
            segmentTransportModes: initialModes,
          });
        }
      })
      .catch((err) => {
        console.warn('Error analyzing journey segments:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    constraints.startLocation,
    constraints.returnLocation,
    constraints.sameReturnLocation,
    constraints.startCoordinates,
    constraints.returnCoordinates,
    destinations,
  ]);

  // Handler for individual segment mode change
  const handleSegmentModeChange = (segmentId: string, mode: TransportMode) => {
    const updated = {
      ...(constraints.segmentTransportModes || {}),
      [segmentId]: mode,
    };
    onChangeConstraints({
      ...constraints,
      segmentTransportModes: updated,
    });
  };

  // Quick apply helper across all segments where the chosen mode is available
  const handleApplyToAllSegments = (mode: TransportMode) => {
    if (!analysis?.segments) return;
    const updated: Record<string, TransportMode> = {
      ...(constraints.segmentTransportModes || {}),
    };
    analysis.segments.forEach((seg) => {
      const isAvailable = seg.availableOptions.some((o) => o.mode === mode);
      if (isAvailable) {
        updated[seg.id] = mode;
      }
    });
    onChangeConstraints({
      ...constraints,
      transportPreference: mode,
      segmentTransportModes: updated,
    });
  };

  const handleToggleRentedBike = (wants: boolean) => {
    setWantsRentalBike(wants);
    if (!wants) {
      setSelectedRentalShop(null);
      onChangeConstraints({
        ...constraints,
        wantsRentedBike: false,
        rentalPickupShop: undefined,
        transportPreference:
          constraints.transportPreference === 'bike_rental'
            ? 'system_choice'
            : constraints.transportPreference,
      });
    } else {
      onChangeConstraints({
        ...constraints,
        wantsRentedBike: true,
        transportPreference: 'bike_rental',
      });
    }
  };

  const handleSelectRentalPickup = (shop: RentalBusiness | null) => {
    if (!shop) {
      setSelectedRentalShop(null);
      onChangeConstraints({
        ...constraints,
        rentalPickupShop: undefined,
      });
      return;
    }

    setSelectedRentalShop(shop);
    onChangeConstraints({
      ...constraints,
      transportPreference: 'bike_rental',
      wantsRentedBike: true,
      rentalPickupShop: {
        placeId: shop.placeId,
        name: shop.name,
        address: shop.address,
        latitude: shop.latitude,
        longitude: shop.longitude,
        distanceKm: shop.distanceKm,
        estimatedTravelMinutes: shop.estimatedTravelMinutes,
        estimatedTravelTimeFormatted: shop.estimatedTravelTimeFormatted,
        rating: shop.rating,
        userRatingsTotal: shop.userRatingsTotal,
        phoneNumber: shop.phoneNumber,
        website: shop.website,
        openNow: shop.openNow,
        openingStatusText: shop.openingStatusText,
        regularOpeningHours: shop.regularOpeningHours,
        rentalPriceInfo: shop.rentalPriceInfo,
      },
    });
  };

  // Compute live trip totals based on user's selected mode for each segment, plus rental pickup transit if selected
  const tripTotals = useMemo(() => {
    if (!analysis?.segments) {
      return { totalDistanceKm: 0, totalDurationMinutes: 0, totalMinFare: 0, totalMaxFare: 0, countPerMode: {} as Record<string, number> };
    }

    let totalDist = 0;
    let totalDur = 0;
    let totalMin = 0;
    let totalMax = 0;
    const countPerMode: Record<string, number> = {};

    // Include travel to rental shop and vehicle inspection dwell if rented bike is selected
    if (selectedRentalShop) {
      totalDist += selectedRentalShop.distanceKm;
      totalDur += (selectedRentalShop.estimatedTravelMinutes || 10) + 10;
      countPerMode['bike_rental'] = (countPerMode['bike_rental'] || 0) + 1;
    }

    analysis.segments.forEach((seg) => {
      const chosenMode =
        constraints.segmentTransportModes?.[seg.id] ||
        seg.recommendedOption?.mode ||
        seg.selectedMode;

      const chosenOpt =
        seg.availableOptions.find((o) => o.mode === chosenMode) ||
        seg.availableOptions[0];

      if (chosenOpt) {
        totalDist += chosenOpt.distanceKm;
        totalDur += chosenOpt.durationMinutes;
        totalMin += chosenOpt.fareEstimate?.minAmount ?? chosenOpt.fareEstimate?.amount ?? 0;
        totalMax += chosenOpt.fareEstimate?.maxAmount ?? chosenOpt.fareEstimate?.amount ?? 0;
        countPerMode[chosenOpt.mode] = (countPerMode[chosenOpt.mode] || 0) + 1;
      }
    });

    return {
      totalDistanceKm: Math.round(totalDist * 10) / 10,
      totalDurationMinutes: totalDur,
      totalMinFare: totalMin,
      totalMaxFare: totalMax,
      countPerMode,
    };
  }, [analysis, constraints.segmentTransportModes, selectedRentalShop]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Destinations</span>
          </button>
          <span className="block text-xs font-bold text-teal-600 uppercase tracking-widest">
            Step 3 of 4 • Consecutive Location Pairs
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Transport Options Between Destinations
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Select the best transportation option for each consecutive location pair. Options and travel metrics are calculated independently per segment.
          </p>
        </div>
      </div>

      {/* Case 1: No starting location */}
      {!hasStartLocation && (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Select a starting location to see available transportation options.
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              We cannot calculate route feasibility or travel times without knowing where your journey begins.
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            ← Set Starting Location
          </button>
        </div>
      )}

      {/* Case 2: No destinations selected */}
      {hasStartLocation && !hasDestinations && (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Select destinations first to see available transportation options.
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Add the places you want to visit so we can analyze each route segment between them.
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-colors"
          >
            ← Select Destinations
          </button>
        </div>
      )}

      {/* Case 3: Loading Route Data */}
      {hasStartLocation && hasDestinations && isLoading && (
        <div className="bg-white rounded-3xl p-12 border border-slate-200/90 shadow-xs text-center space-y-4">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Calculating independent transport options for each leg...
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Evaluating walking, two-wheeler, driving, taxi/ride-hailing, metro, and city bus availability.
            </p>
          </div>
        </div>
      )}

      {/* Case 4: Route Options Ready */}
      {hasStartLocation && hasDestinations && !isLoading && analysis && (
        <div className="space-y-6">
          {/* Journey Sequence Strip */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-sm">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-400">
              Consecutive Route Segments ({analysis.segments.length} Legs)
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-semibold text-slate-200">
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                {constraints.startLocation}
              </span>
              {destinations.map((d, idx) => (
                <React.Fragment key={d.id}>
                  <span className="text-slate-400 font-bold">→</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white">
                    {idx + 1}. {d.name}
                  </span>
                </React.Fragment>
              ))}
              <span className="text-slate-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white">
                {constraints.sameReturnLocation
                  ? 'Return (Start Hub)'
                  : constraints.returnLocation || constraints.startLocation}
              </span>
            </div>
          </div>

          {/* Quick Apply Helper Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700">
              Quick apply to all supported legs:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyToAllSegments('walking')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>🚶</span> Walking
              </button>
              <button
                type="button"
                onClick={() => handleApplyToAllSegments('two_wheeler')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>🏍️</span> Two-wheeler
              </button>
              <button
                type="button"
                onClick={() => handleApplyToAllSegments('auto_cab')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>🚕</span> Taxi / Ride-hailing
              </button>
              <button
                type="button"
                onClick={() => handleApplyToAllSegments('driving')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>🚗</span> Driving
              </button>
              <button
                type="button"
                onClick={() => {
                  handleToggleRentedBike(true);
                  handleApplyToAllSegments('two_wheeler');
                }}
                className={`px-3 py-1.5 rounded-xl border font-semibold transition-colors flex items-center gap-1.5 ${
                  wantsRentalBike
                    ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-200 font-bold'
                    : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700'
                }`}
              >
                <span>🏍️</span> Rented Bike / Two-wheeler rental
              </button>
            </div>
          </div>

          {/* Dedicated Two-Wheeler Rental Flow Section */}
          <div
            id="two-wheeler-rental-flow-card"
            className={`rounded-3xl p-5 sm:p-6 border transition-all ${
              wantsRentalBike
                ? 'bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/40 border-teal-300 ring-1 ring-teal-200 shadow-sm'
                : 'bg-white border-slate-200/90 shadow-xs'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="text-2xl p-2.5 rounded-2xl bg-teal-100 text-teal-800 shrink-0">
                  🏍️
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Rented Bike / Two-Wheeler Rental Flow
                    </h4>
                    {wantsRentalBike && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-600 text-white uppercase tracking-wider">
                        Active Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    {wantsRentalBike
                      ? 'Self-drive rental mode is active. Choose a verified local rental business near your start location to include vehicle pickup in your trip itinerary.'
                      : 'Choose "Rented Bike" if you prefer to rent a scooter or motorcycle near your starting location for self-drive flexibility between destinations.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {wantsRentalBike ? (
                  <button
                    type="button"
                    onClick={() => handleToggleRentedBike(false)}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs"
                  >
                    Cancel Rental Flow
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleRentedBike(true)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-xs hover:shadow-sm"
                  >
                    Choose Rented Bike / Two-wheeler rental
                  </button>
                )}
              </div>
            </div>

            {/* Render rental businesses ONLY if user chooses Rented Bike */}
            {wantsRentalBike && (
              <div className="mt-5 pt-5 border-t border-teal-200/70 space-y-4">
                {selectedRentalShop ? (
                  <div className="bg-teal-900 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-teal-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                        <span>Itinerary Sequence Updated for Rented Bike:</span>
                      </div>
                      <p className="text-[11px] text-teal-100 font-medium">
                        START ({constraints.startLocation}) → Travel to {selectedRentalShop.name} ({selectedRentalShop.distanceKm.toFixed(1)} km, {selectedRentalShop.estimatedTravelTimeFormatted}) → Pick Up Bike (10 min dwell) → Destinations ({destinations.length} stops) → Return
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectRentalPickup(null)}
                      className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-teal-100 text-xs font-semibold self-start sm:self-auto transition-colors"
                    >
                      Change Rental Shop
                    </button>
                  </div>
                ) : (
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 text-xs text-teal-950 flex items-start gap-2">
                    <span className="font-bold text-teal-700">Trip Flow Ready:</span>
                    <span>
                      Select your preferred rental business below to automatically insert the vehicle pickup leg into your itinerary.
                    </span>
                  </div>
                )}

                <NearbyBikeRentals
                  startLocation={constraints.startLocation}
                  startCoordinates={constraints.startCoordinates}
                  selectedShopId={selectedRentalShop?.placeId}
                  onSelectRentalShop={handleSelectRentalPickup}
                />
              </div>
            )}
          </div>

          {/* Core Presentation: Independent Consecutive Location Pairs */}
          <div className="space-y-6">
            {analysis.segments.map((seg, sIdx) => {
              const currentMode =
                constraints.segmentTransportModes?.[seg.id] ||
                seg.recommendedOption?.mode ||
                seg.selectedMode;

              const walkOpt = seg.availableOptions.find((o) => o.mode === 'walking');
              const isShortWalk = Boolean(walkOpt && walkOpt.distanceKm <= 2.0);

              return (
                <div
                  key={seg.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4 transition-all"
                >
                  {/* Segment Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                        Leg {sIdx + 1} of {analysis.segments.length}
                      </span>
                      <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                        <span className="text-slate-700">{seg.fromName}</span>
                        <span className="text-teal-600 font-black">→</span>
                        <span className="text-slate-900">{seg.toName}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {seg.plannedDepartureTimeFormatted && (
                        <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-600" />
                          Planned Departure: {seg.plannedDepartureTimeFormatted}
                        </span>
                      )}
                      {isShortWalk && (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                          <span>🚶</span> Short distance ({walkOpt?.distanceKm} km) — Walking preferred (₹0)
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        Selected: {formatTransportName(currentMode)}
                      </span>
                    </div>
                  </div>

                  {/* Available Options for This Specific Segment */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                      Available Options for this Segment ({seg.availableOptions.length} Options)
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {seg.availableOptions.map((opt) => {
                        const isSelected = currentMode === opt.mode;

                        return (
                          <div
                            key={opt.key}
                            onClick={() => handleSegmentModeChange(seg.id, opt.mode)}
                            className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-teal-600 bg-teal-50/70 shadow-sm ring-2 ring-teal-500/20'
                                : opt.isRecommended
                                ? 'border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40 hover:border-emerald-400'
                                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                            }`}
                          >
                            <div>
                              {/* Option Top: Icon, Name, and Badges */}
                              <div className="flex items-start justify-between gap-1 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{opt.icon}</span>
                                  <div>
                                    <h4 className="text-xs font-black text-slate-900 leading-tight">
                                      {opt.name}
                                    </h4>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {opt.isRecommended && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {opt.recommendationTag || 'Recommended'}
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-teal-300">
                                      <Check className="w-3 h-3 text-teal-700" />
                                      Selected
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Distance & Travel Time & Live Route Badge */}
                              <div className="text-xs text-slate-700 font-semibold flex flex-wrap items-center gap-2 mt-2">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  ~{opt.durationFormatted}
                                </span>
                                <span>•</span>
                                <span>~{opt.distanceKm} km</span>
                                {opt.isRealRoute ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                    Live API Route
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    Estimated
                                  </span>
                                )}
                              </div>

                              {/* Detailed Transit Breakdown (When transit data is available) */}
                              {opt.transitDisplay && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/70 space-y-1.5 text-[11px] text-slate-600">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-slate-800 flex items-center gap-1 truncate">
                                      <span>
                                        {opt.transitDisplay.transitType === 'BUS'
                                          ? '🚌'
                                          : opt.transitDisplay.transitType === 'TRAIN'
                                          ? '🚆'
                                          : '🚇'}
                                      </span>
                                      {opt.transitDisplay.routeLineNumber
                                        ? `${opt.transitDisplay.transitTypeLabel} • Line ${opt.transitDisplay.routeLineNumber}`
                                        : opt.transitDisplay.routeLineName
                                        ? `${opt.transitDisplay.transitTypeLabel} • ${opt.transitDisplay.routeLineName}`
                                        : opt.transitDisplay.transitTypeLabel}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 shrink-0">
                                      {opt.transitDisplay.transfersLabel}
                                    </span>
                                  </div>

                                  {(opt.transitDisplay.departureTime || opt.transitDisplay.arrivalTime) && (
                                    <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                                      <Clock className="w-3 h-3 text-teal-600 shrink-0" />
                                      <span>
                                        {opt.transitDisplay.departureTime ? `Departs ${opt.transitDisplay.departureTime}` : ''}
                                        {opt.transitDisplay.departureTime && opt.transitDisplay.arrivalTime ? ' → ' : ''}
                                        {opt.transitDisplay.arrivalTime ? `Arrives ${opt.transitDisplay.arrivalTime}` : ''}
                                      </span>
                                    </div>
                                  )}

                                  {opt.transitDisplay.departureStopName && opt.transitDisplay.arrivalStopName && (
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {opt.transitDisplay.departureStopName} → {opt.transitDisplay.arrivalStopName}
                                      {opt.transitDisplay.stopCount ? ` (${opt.transitDisplay.stopCount} stops)` : ''}
                                    </div>
                                  )}

                                  {opt.transitDisplay.walkingPortions && opt.transitDisplay.walkingPortions.totalDistanceMeters > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                                      <span>🚶</span>
                                      <span>
                                        Walking portion: {opt.transitDisplay.walkingPortions.totalDistanceFormatted} (~{opt.transitDisplay.walkingPortions.totalDurationMinutes} min)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Non-transit details */}
                              {!opt.transitDisplay && opt.details && (
                                <p className="text-[11px] text-slate-500 mt-1.5 leading-snug line-clamp-2">
                                  {opt.details}
                                </p>
                              )}
                            </div>

                            {/* Estimated Cost */}
                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Est. Cost:</span>
                              <span className="font-extrabold text-slate-900">
                                {opt.estimatedFareFormatted}
                              </span>
                            </div>

                            {/* Provider note */}
                            {opt.fareSourceLabel && (
                              <p className="text-[9px] text-slate-400 mt-1 leading-tight italic">
                                {opt.fareSourceLabel}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trip Transportation Summary Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-400">
                  Total Trip Transportation Summary
                </span>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  Aggregate Metrics for Selected Segment Modes
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                {analysis.segments.length} Legs Planned
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                  Total Travel Distance
                </span>
                <p className="text-xl font-black text-white mt-1">
                  ~{tripTotals.totalDistanceKm} km
                </p>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Sum of chosen segment paths
                </span>
              </div>

              <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                  Total Travel Time
                </span>
                <p className="text-xl font-black text-white mt-1">
                  ~{Math.floor(tripTotals.totalDurationMinutes / 60) > 0
                    ? `${Math.floor(tripTotals.totalDurationMinutes / 60)} hr ${tripTotals.totalDurationMinutes % 60} min`
                    : `${tripTotals.totalDurationMinutes} min`}
                </p>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  In-transit travel across all legs
                </span>
              </div>

              <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                  Estimated Transport Cost
                </span>
                <p className="text-xl font-black text-emerald-400 mt-1">
                  {tripTotals.totalMinFare === 0 && tripTotals.totalMaxFare === 0
                    ? '₹0 (Free self-mobility)'
                    : `₹${tripTotals.totalMinFare}–₹${tripTotals.totalMaxFare}`}
                </p>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Combined estimated fares
                </span>
              </div>
            </div>

            {/* Selected Modes Breakdown */}
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 pt-1">
              <span className="text-slate-400 font-medium">Selected modes:</span>
              {Object.entries(tripTotals.countPerMode).map(([mode, count]) => (
                <span
                  key={mode}
                  className="px-2 py-0.5 rounded-lg bg-white/10 text-white font-semibold text-[11px]"
                >
                  {formatTransportName(mode as TransportMode)} ({count})
                </span>
              ))}
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← Back to Destinations
            </button>

            <button
              id="proceed-to-feasibility-btn"
              type="button"
              onClick={onProceed}
              className="px-8 py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/10 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 text-base"
            >
              <span>Check Trip Feasibility</span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
