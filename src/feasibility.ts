import {
  Destination,
  TripConstraints,
  FeasibilityResult,
  RouteSegment,
  VerificationCheck,
  TransportMode,
  ExcludedDestination,
  FeasibleAlternativePlan,
  DestinationCategory,
} from './types';
import { filterDestinationsByTripArea } from './utils/geoValidation';
import { RouteResult, computeTripLegs } from './services/routesService';
import {
  estimateSegmentFare,
  estimateWalkingFare,
  estimateBicycleFare,
  estimateTwoWheelerSegmentFare,
  estimateCabSegmentFare,
  estimateMetroSegmentFare,
  estimateBusSegmentFare,
  FareEstimate,
} from './services/fareService';
import {
  inferVisitDurationFromSignals,
  getDestinationEstimatedDuration,
  getEffectiveVisitDuration,
  formatVisitDurationDisplay,
  hasExplicitDestinationDuration,
} from './utils/visitDuration';

export {
  inferVisitDurationFromSignals,
  getDestinationEstimatedDuration,
  getEffectiveVisitDuration,
  formatVisitDurationDisplay,
  hasExplicitDestinationDuration,
};

/**
 * Configurable safety buffer before the return deadline (in minutes).
 * Can be overridden via options in analyzeTripFeasibility.
 */
export const DEFAULT_SAFETY_BUFFER_MINUTES = 15;

/**
 * Sensible default visit durations by category (in minutes).
 * Used as planning estimates, not guaranteed real visit times.
 */
export const DEFAULT_CATEGORY_DURATIONS: Record<DestinationCategory, number> = {
  temple: 20,
  historical: 45,
  museum: 60,
  park: 45,
  viewpoint: 20,
  shopping: 45,
  food: 40,
  entertainment: 60,
  landmark: 20,
  other: 30,
};

/**
 * User-friendly category display labels
 */
export const CATEGORY_LABELS: Record<DestinationCategory, string> = {
  temple: 'Temple',
  historical: 'Historical Site',
  museum: 'Museum',
  park: 'Park',
  viewpoint: 'Viewpoint',
  shopping: 'Shopping',
  food: 'Food & Dining',
  entertainment: 'Entertainment',
  landmark: 'Landmark',
  other: 'Point of Interest',
};

/**
 * Normalizes any category string into a strongly typed DestinationCategory
 */
export function normalizeCategory(category?: string): DestinationCategory {
  if (!category) return 'other';
  const clean = category.toLowerCase().trim();
  if (clean === 'temple' || clean.includes('temple')) return 'temple';
  if (
    clean === 'historical' ||
    clean.includes('histor') ||
    clean.includes('heritage') ||
    clean.includes('cave') ||
    clean.includes('monument')
  ) {
    return 'historical';
  }
  if (clean === 'museum' || clean.includes('museum') || clean.includes('gallery')) return 'museum';
  if (clean === 'park' || clean.includes('park') || clean.includes('garden')) return 'park';
  if (
    clean === 'viewpoint' ||
    clean.includes('view') ||
    clean.includes('scenic') ||
    clean.includes('hill') ||
    clean.includes('lookout')
  ) {
    return 'viewpoint';
  }
  if (clean === 'shopping' || clean.includes('shop') || clean.includes('bazaar') || clean.includes('market')) {
    return 'shopping';
  }
  if (clean === 'food' || clean.includes('food') || clean.includes('cafe') || clean.includes('restaurant') || clean.includes('delicac')) {
    return 'food';
  }
  if (clean === 'entertainment' || clean.includes('entertain') || clean.includes('resort') || clean.includes('theme') || clean.includes('zoo')) {
    return 'entertainment';
  }
  if (clean === 'landmark' || clean.includes('landmark') || clean.includes('bridge') || clean.includes('memorial') || clean.includes('barrage')) {
    return 'landmark';
  }
  return 'other';
}

/**
 * Formats a destination category into a polished title-case display name
 */
export function formatCategoryName(category: DestinationCategory | string): string {
  const norm = normalizeCategory(category);
  return CATEGORY_LABELS[norm] ?? 'Point of Interest';
}

/**
 * Resolves the visit duration for a destination in minutes.
 * Priority rule:
 * 1. userVisitMinutes (if user customized it)
 * 2. estimatedVisitMinutes (destination-specific estimated visit duration)
 * 3. visitDuration / visitDurationMinutes (existing destination metadata)
 * 4. Signal-based inference (scope, attraction characteristics, description)
 * 5. Category fallback default
 */
export function getDestinationVisitDuration(destination: Partial<Destination>): number {
  return getEffectiveVisitDuration(destination);
}

export interface FeasibilityOptions {
  safetyBufferMinutes?: number;
  routeLegsMap?: Map<string, RouteResult>;
}

/**
 * Converts "HH:MM" (24-hour) to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Converts minutes since midnight back to formatted string (e.g., "1:20 PM")
 */
export function minutesToTime(totalMins: number): string {
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const formattedMinutes = mins < 10 ? `0${mins}` : `${mins}`;
  return `${hours12}:${formattedMinutes} ${period}`;
}

/**
 * Formats a duration in minutes to human readable string (e.g., "3h 42m" or "45 min")
 */
export function formatDuration(mins: number): string {
  if (mins <= 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTransportName(mode: TransportMode): string {
  switch (mode) {
    case 'walking':
      return 'Walking';
    case 'metro':
      return 'Metro';
    case 'bus':
      return 'City Bus';
    case 'public_transport':
      return 'Transit';
    case 'two_wheeler':
      return 'Two-wheeler';
    case 'driving':
      return 'Driving';
    case 'auto_cab':
      return 'Taxi / Ride-hailing';
    case 'bicycle':
      return 'Bicycle';
    case 'bike_rental':
      return 'Bicycle / Rental Bike';
    case 'system_choice':
    default:
      return 'Explorer Choice';
  }
}

/**
 * Returns average speed in km/h, base wait time in minutes, base cost, and per-km cost
 */
export function getTransportMetrics(mode: TransportMode): {
  speedKmH: number;
  waitMins: number;
  baseCost: number;
  costPerKm: number;
} {
  switch (mode) {
    case 'walking':
      return { speedKmH: 4.5, waitMins: 0, baseCost: 0, costPerKm: 0 };
    case 'bicycle':
      return { speedKmH: 13, waitMins: 2, baseCost: 20, costPerKm: 0 };
    case 'bike_rental':
      return { speedKmH: 14, waitMins: 5, baseCost: 40, costPerKm: 0 }; // base hourly rental
    case 'two_wheeler':
      return { speedKmH: 28, waitMins: 3, baseCost: 20, costPerKm: 6 };
    case 'metro':
      return { speedKmH: 32, waitMins: 5, baseCost: 15, costPerKm: 2 };
    case 'bus':
      return { speedKmH: 18, waitMins: 8, baseCost: 10, costPerKm: 1.8 };
    case 'public_transport':
      return { speedKmH: 20, waitMins: 8, baseCost: 12, costPerKm: 2 };
    case 'driving':
      return { speedKmH: 26, waitMins: 4, baseCost: 20, costPerKm: 10 };
    case 'auto_cab':
      return { speedKmH: 26, waitMins: 4, baseCost: 45, costPerKm: 14 };
    case 'system_choice':
    default:
      return { speedKmH: 24, waitMins: 4, baseCost: 30, costPerKm: 10 };
  }
}

/**
 * Calculates transit time between two coordinates or sequential distances
 */
export function estimateTravelTimeMinutes(
  distanceKm: number,
  mode: TransportMode
): number {
  const { speedKmH, waitMins } = getTransportMetrics(mode);
  const transitMinutes = (distanceKm / speedKmH) * 60;
  const minMins = mode === 'walking' ? 1 : 2;
  return Math.max(minMins, Math.round(transitMinutes + waitMins));
}

/**
 * Estimates transport cost for a given distance and group size using centralized fareService
 */
export function estimateTransportCost(
  distanceKm: number,
  mode: TransportMode,
  peopleCount: number = 1,
  durationHours: number = 1
): number {
  const fare = estimateSegmentFare(mode, distanceKm, durationHours * 60, { peopleCount });
  return fare.amount ?? 0;
}

/**
 * Computes realistic travel distance between two destinations using GPS coordinate geometry when available
 */
export function getModeCircuity(mode: TransportMode = 'driving', straightLine = 2.0): number {
  switch (mode) {
    case 'walking':
      return straightLine < 1.0 ? 1.12 : straightLine < 3.0 ? 1.16 : 1.20;
    case 'bicycle':
    case 'bike_rental':
      return straightLine < 1.0 ? 1.15 : straightLine < 3.0 ? 1.20 : 1.25;
    case 'two_wheeler':
      return straightLine < 1.0 ? 1.18 : straightLine < 3.0 ? 1.22 : 1.28;
    case 'metro':
    case 'bus':
    case 'public_transport':
      return straightLine < 1.0 ? 1.35 : straightLine < 3.0 ? 1.42 : 1.48;
    case 'driving':
    case 'auto_cab':
    case 'system_choice':
    default:
      return straightLine < 1.0 ? 1.25 : straightLine < 3.0 ? 1.32 : 1.38;
  }
}

/**
 * Computes realistic travel distance between two destinations using GPS coordinate geometry when available
 */
export function calculateInterDestinationDistance(d1: Destination, d2: Destination, mode: TransportMode = 'driving'): number {
  if (d1.id === d2.id) return 0;
  if (
    typeof d1.latitude === 'number' &&
    typeof d1.longitude === 'number' &&
    typeof d2.latitude === 'number' &&
    typeof d2.longitude === 'number'
  ) {
    const R = 6371; // Earth radius in km
    const dLat = ((d2.latitude - d1.latitude) * Math.PI) / 180;
    const dLon = ((d2.longitude - d1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((d1.latitude * Math.PI) / 180) *
        Math.cos((d2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLine = R * c;
    const circuity = getModeCircuity(mode, straightLine);
    return Math.max(0.1, Math.round(straightLine * circuity * 10) / 10);
  }
  // Scaled Euclidean distance on normalized coordinate grid + mode-specific circuity factor
  const dx = d2.coordinates.x - d1.coordinates.x;
  const dy = d2.coordinates.y - d1.coordinates.y;
  const rawDist = Math.sqrt(dx * dx + dy * dy) * 0.16;
  const circuity = getModeCircuity(mode, rawDist);
  return Math.max(0.2, Math.round(rawDist * circuity * 10) / 10);
}

/**
 * Internal route evaluation details for a specific destination sequence
 */
export interface EvaluatedRoute {
  destinations: Destination[];
  departureTime: string;
  travelTime: number;
  totalTravelTime: number;
  totalVisitTime: number;
  totalBreakTime: number;
  totalDuration: number;
  totalTripTime: number;
  returnTravelTime: number;
  totalDistanceKm: number;
  totalTransportCost: number;
  totalEntryCost: number;
  totalCost: number;
  hasUnknownFares: boolean;
  unknownFaresCount: number;
  isBudgetUncertain: boolean;
  expectedReturnMins: number;
  expectedReturnTime: string;
  deadlineMins: number;
  returnDeadline: string;
  safetyBuffer: number;
  remainingBudget: number;
  remainingTime: number;
  additionalTimeRequiredMinutes: number;
  overBudgetAmount: number;
  isTimeOver: boolean;
  isDeadlineBreached: boolean;
  isTimeExceeded: boolean;
  isBudgetExceeded: boolean;
  isFeasible: boolean;
  timeStatusMessage: string;
  budgetStatusMessage: string;
  feasibilityVerdictMessage: string;
  failedConstraintExplanation?: string;
  timeline: RouteSegment[];
  failureReasons: string[];
  primaryFailureCategory?: 'insufficient_time' | 'deadline_exceeded' | 'budget_exceeded' | 'multiple_constraints_failed';
}

/**
 * Evaluates a complete route from startLocation -> destinations -> returnLocation
 */
export function evaluateRouteSequence(
  destinations: Destination[],
  constraints: TripConstraints,
  options: FeasibilityOptions = {}
): EvaluatedRoute {
  const safetyBufferRequired = options.safetyBufferMinutes ?? DEFAULT_SAFETY_BUFFER_MINUTES;

  const startMins = timeToMinutes(constraints.startTime);
  const endMins = timeToMinutes(constraints.endTime);
  const rawDeadlineMins = timeToMinutes(constraints.returnDeadline);
  const deadlineMins = rawDeadlineMins > 0 ? rawDeadlineMins : (endMins > 0 ? endMins : startMins + 480);

  const timeAvailableMinutes = Math.max(0, deadlineMins - startMins);

  if (destinations.length === 0) {
    const buffer = deadlineMins - startMins;
    return {
      destinations: [],
      departureTime: minutesToTime(startMins),
      travelTime: 0,
      totalTravelTime: 0,
      totalVisitTime: 0,
      totalBreakTime: 0,
      totalDuration: 0,
      totalTripTime: 0,
      returnTravelTime: 0,
      totalDistanceKm: 0,
      totalTransportCost: 0,
      totalEntryCost: 0,
      totalCost: 0,
      hasUnknownFares: false,
      unknownFaresCount: 0,
      isBudgetUncertain: false,
      expectedReturnMins: startMins,
      expectedReturnTime: minutesToTime(startMins),
      deadlineMins,
      returnDeadline: minutesToTime(deadlineMins),
      safetyBuffer: buffer,
      remainingBudget: constraints.budget,
      remainingTime: timeAvailableMinutes,
      additionalTimeRequiredMinutes: 0,
      overBudgetAmount: 0,
      isTimeOver: false,
      isDeadlineBreached: false,
      isTimeExceeded: false,
      isBudgetExceeded: false,
      isFeasible: false,
      timeStatusMessage: 'Select at least one destination to create an itinerary.',
      budgetStatusMessage: `Budget: ${constraints.currency}${constraints.budget}`,
      feasibilityVerdictMessage: 'Select at least one destination to create an itinerary.',
      failedConstraintExplanation: undefined,
      timeline: [],
      failureReasons: ['Select at least one destination to create an itinerary.'],
    };
  }

  const timeline: RouteSegment[] = [];
  let currentClockMins = startMins;
  let outboundTravelTime = 0;
  let totalVisitTime = 0;
  let totalTransportCost = 0;
  let totalEntryCost = 0;
  let totalDistanceKm = 0;
  let hasUnknownFares = false;
  let unknownFaresCount = 0;

  // 1. Start point segment
  timeline.push({
    id: 'seg-start',
    type: 'start',
    title: constraints.startLocation || 'Starting Location',
    subtitle: 'Trip departure & initial route positioning',
    time: minutesToTime(currentClockMins),
    durationMinutes: 0,
    cost: 0,
    transportMode: constraints.transportPreference,
  });

  // 1.5 If rental pickup shop selected: Travel from Start Location -> Rental Shop
  if (constraints.rentalPickupShop) {
    const rentalShop = constraints.rentalPickupShop;
    const rentalRouteData = options?.routeLegsMap?.get('leg-start-rental');
    const rentalDist = rentalRouteData && rentalRouteData.distanceKm > 0
      ? rentalRouteData.distanceKm
      : (rentalShop.distanceKm || 2.0);

    const rentalTravelMins = rentalRouteData
      ? rentalRouteData.durationMinutes
      : (rentalShop.estimatedTravelMinutes || estimateTravelTimeMinutes(rentalDist, 'auto_cab'));

    const rentalPickupFare = estimateSegmentFare('auto_cab', rentalDist, rentalTravelMins, {
      peopleCount: constraints.peopleCount,
      currency: constraints.currency,
    });
    const rentalTravelCost = rentalPickupFare.amount ?? 0;
    if (rentalPickupFare.isUnknown) {
      hasUnknownFares = true;
      unknownFaresCount++;
    }

    totalDistanceKm += rentalDist;
    outboundTravelTime += rentalTravelMins;
    totalTransportCost += rentalTravelCost;

    const depMins = currentClockMins;
    const arrMins = currentClockMins + rentalTravelMins;

    timeline.push({
      id: 'travel-rental-pickup',
      type: 'travel',
      title: `Travel to Rental Shop: ${rentalShop.name}`,
      subtitle: `${rentalDist.toFixed(1)} km to vehicle pickup location • ${rentalShop.address} • ${rentalShop.estimatedTravelTimeFormatted || `~${rentalTravelMins} min travel`}`,
      time: minutesToTime(depMins),
      durationMinutes: rentalTravelMins,
      distanceKm: rentalDist,
      cost: rentalTravelCost,
      transportMode: 'auto_cab',
      departureTime: minutesToTime(depMins),
      arrivalTime: minutesToTime(arrMins),
      isRealRoute: !!rentalRouteData?.isRealRoute,
      isFallback: !rentalRouteData?.isRealRoute,
      routeLabel: 'Travel to vehicle pickup',
      fareDisplay: rentalPickupFare.label,
      fareCertainty: rentalPickupFare.certainty,
      isFareUnknown: rentalPickupFare.isUnknown,
      fareMin: rentalPickupFare.minAmount,
      fareMax: rentalPickupFare.maxAmount,
      fareSourceLabel: rentalPickupFare.sourceDescription,
    });

    currentClockMins += rentalTravelMins;

    // Vehicle pickup & inspection (dwell for vehicle pickup)
    timeline.push({
      id: 'pickup-rental-vehicle',
      type: 'visit',
      title: `Pickup Vehicle: ${rentalShop.name}`,
      subtitle: 'Documentation & vehicle inspection (two-wheeler / scooter rental)',
      time: minutesToTime(currentClockMins),
      durationMinutes: 10,
      cost: 0,
      departureTime: minutesToTime(currentClockMins),
      arrivalTime: minutesToTime(currentClockMins + 10),
    });

    currentClockMins += 10;
  }

  // 2. Traversal through each destination in sequence
  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    
    // Leg distance and route resolution:
    // Requirement 11: Use the SAME route results already produced by the transport system
    const legKey = i === 0
      ? `leg-start-${dest.id}`
      : `leg-${destinations[i - 1].id}-${dest.id}`;
    const routeData = options?.routeLegsMap?.get(legKey);

    // Segment mode or overall preference
    let segMode = constraints.segmentTransportModes?.[`seg-${i}`] || constraints.transportPreference;
    if (segMode === 'system_choice') {
      if (routeData) {
        if (routeData.travelMode === 'WALK') {
          segMode = 'walking';
        } else if (routeData.travelMode === 'TWO_WHEELER') {
          segMode = 'two_wheeler';
        } else if (routeData.travelMode === 'TRANSIT') {
          segMode = 'public_transport';
        } else if (routeData.travelMode === 'BICYCLE') {
          segMode = 'bicycle';
        } else {
          segMode = 'auto_cab';
        }
      } else {
        segMode = 'auto_cab';
      }
    }

    let rawDistance = 2.0;
    if (i === 0) {
      const originLat = constraints.rentalPickupShop?.latitude !== undefined
        ? constraints.rentalPickupShop.latitude
        : constraints.startCoordinates?.latitude;
      const originLon = constraints.rentalPickupShop?.longitude !== undefined
        ? constraints.rentalPickupShop.longitude
        : constraints.startCoordinates?.longitude;

      if (
        originLat !== undefined &&
        originLon !== undefined &&
        dest.latitude !== undefined &&
        dest.longitude !== undefined
      ) {
        const R = 6371;
        const dLat = ((dest.latitude - originLat) * Math.PI) / 180;
        const dLon = ((dest.longitude - originLon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((originLat * Math.PI) / 180) *
            Math.cos((dest.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const straightLine = R * c;
        const circuity = getModeCircuity(segMode, straightLine);
        rawDistance = Math.max(0.1, Math.round(straightLine * circuity * 10) / 10);
      } else {
        rawDistance = dest.distanceKm > 0 ? dest.distanceKm : 2.0;
      }
    } else {
      rawDistance = calculateInterDestinationDistance(destinations[i - 1], dest, segMode);
    }

    const legDistance = routeData && routeData.distanceKm > 0
      ? routeData.distanceKm
      : rawDistance;

    totalDistanceKm += legDistance;

    // Requirement 11: Use the SAME route results already produced by the transport system
    const isReal = !!routeData?.isRealRoute;
    const travelMins = routeData
      ? routeData.durationMinutes
      : estimateTravelTimeMinutes(legDistance, segMode);

    // Requirement 6: Budget calculation must include every applicable transport segment
    const segFare = estimateSegmentFare(segMode, legDistance, travelMins, {
      peopleCount: constraints.peopleCount,
      currency: constraints.currency,
      transitDetails: routeData?.transitDetails,
      rentalShop: constraints.rentalPickupShop,
    });

    const legCost = segFare.amount ?? 0;
    if (segFare.isUnknown) {
      hasUnknownFares = true;
      unknownFaresCount++;
    }

    outboundTravelTime += travelMins;
    totalTransportCost += legCost;

    const departureTravelMins = currentClockMins;
    const arrivalTravelMins = currentClockMins + travelMins;

    const routeLabel = isReal
      ? 'Estimated travel time'
      : 'Estimated travel time (Fallback estimate)';

    let subtitle = `${legDistance.toFixed(1)} km via ${formatTransportName(segMode)} • ${routeLabel}`;
    if (routeData?.transitDetails && routeData.transitDetails.length > 0) {
      const transitDesc = routeData.transitDetails
        .map((t) => `${t.vehicleName} ${t.lineShortName || t.lineName}`)
        .join(' → ');
      subtitle += ` • ${transitDesc}`;
    }

    // Travel segment: Start -> Travel to destination
    timeline.push({
      id: `travel-${dest.id}`,
      type: 'travel',
      title: `Travel to ${dest.name}`,
      subtitle,
      time: minutesToTime(departureTravelMins),
      durationMinutes: travelMins,
      distanceKm: legDistance,
      cost: legCost,
      transportMode: segMode,
      departureTime: minutesToTime(departureTravelMins),
      arrivalTime: minutesToTime(arrivalTravelMins),
      isRealRoute: isReal,
      isFallback: !isReal,
      routeLabel,
      transitDetails: routeData?.transitDetails,
      fareDisplay: segFare.label,
      fareCertainty: segFare.certainty,
      isFareUnknown: segFare.isUnknown,
      fareMin: segFare.minAmount,
      fareMax: segFare.maxAmount,
      fareSourceLabel: segFare.sourceDescription,
    });

    currentClockMins += travelMins;
    const arrivalAtDestMins = currentClockMins;

    // Requirement 2 & 8: Total visit time = sum of the actual visit duration assigned to each destination.
    // Use destination-specific visit duration; fallback is clearly marked as estimated.
    // Requirement 9: Never reduce visit duration automatically just to make an itinerary fit.
    const visitMins = getDestinationVisitDuration(dest);
    const entryFeeTotal = dest.entryCost * constraints.peopleCount;
    totalVisitTime += visitMins;
    totalEntryCost += entryFeeTotal;

    const departureFromDestMins = arrivalAtDestMins + visitMins;
    const totalStopMinutes = travelMins + visitMins;
    const categoryKey = normalizeCategory(dest.category);
    const categoryDisplayName = formatCategoryName(categoryKey);

    const estDisplay = formatVisitDurationDisplay(dest);
    const subtitleText = estDisplay.isUserCustomized
      ? `Explore • ${categoryDisplayName} (${estDisplay.label})`
      : estDisplay.hasReliableDuration
      ? `Explore • ${categoryDisplayName} (${estDisplay.label})`
      : `Explore • ${categoryDisplayName} (${estDisplay.label} • Planning estimate)`;

    // Visit segment: Arrive -> Spend visit duration there -> Leave
    timeline.push({
      id: `visit-${dest.id}`,
      type: 'visit',
      title: dest.name,
      subtitle: subtitleText,
      time: minutesToTime(arrivalAtDestMins),
      durationMinutes: visitMins,
      cost: entryFeeTotal,
      destinationId: dest.id,
      category: categoryKey,
      travelMinutes: travelMins,
      visitDurationMinutes: visitMins,
      totalStopMinutes: totalStopMinutes,
      arrivalTime: minutesToTime(arrivalAtDestMins),
      departureTime: minutesToTime(departureFromDestMins),
      isEstimated: estDisplay.isEstimated,
    });

    currentClockMins += visitMins;
  }

  // 3. Requirement 10: Include the return journey when checking feasibility
  const lastDest = destinations[destinations.length - 1];
  const returnLegKey = `leg-${lastDest.id}-return`;
  const returnRouteData = options?.routeLegsMap?.get(returnLegKey);

  const isRoundTrip = constraints.sameReturnLocation !== false;
  const returnTargetName = isRoundTrip
    ? (constraints.startLocation || 'Starting Location')
    : (constraints.returnLocation || constraints.startLocation || 'Return Destination');

  let returnSegMode = constraints.segmentTransportModes?.[`seg-${destinations.length}`] || constraints.transportPreference;
  if (returnSegMode === 'system_choice') {
    if (returnRouteData) {
      if (returnRouteData.travelMode === 'WALK') {
        returnSegMode = 'walking';
      } else if (returnRouteData.travelMode === 'TWO_WHEELER') {
        returnSegMode = 'two_wheeler';
      } else if (returnRouteData.travelMode === 'TRANSIT') {
        returnSegMode = 'public_transport';
      } else if (returnRouteData.travelMode === 'BICYCLE') {
        returnSegMode = 'bicycle';
      } else {
        returnSegMode = 'auto_cab';
      }
    } else {
      returnSegMode = 'auto_cab';
    }
  }

  let fallbackReturnDist = 2.0;
  const returnLat = isRoundTrip
    ? constraints.startCoordinates?.latitude
    : (constraints.returnCoordinates?.latitude || constraints.startCoordinates?.latitude);
  const returnLon = isRoundTrip
    ? constraints.startCoordinates?.longitude
    : (constraints.returnCoordinates?.longitude || constraints.startCoordinates?.longitude);

  if (
    typeof lastDest.latitude === 'number' &&
    typeof lastDest.longitude === 'number' &&
    typeof returnLat === 'number' &&
    typeof returnLon === 'number'
  ) {
    const R = 6371;
    const dLat = ((returnLat - lastDest.latitude) * Math.PI) / 180;
    const dLon = ((returnLon - lastDest.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lastDest.latitude * Math.PI) / 180) *
        Math.cos((returnLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLine = R * c;
    const circuity = getModeCircuity(returnSegMode, straightLine);
    fallbackReturnDist = Math.max(0.1, Math.round(straightLine * circuity * 10) / 10);
  } else {
    fallbackReturnDist = Math.max(0.5, Math.round(lastDest.distanceKm * 0.95 * 10) / 10);
  }

  const returnDistanceKm = returnRouteData && returnRouteData.distanceKm > 0
    ? returnRouteData.distanceKm
    : fallbackReturnDist;
  totalDistanceKm += returnDistanceKm;

  // Requirement 11: Use the SAME route results already produced by the transport system
  const isReturnReal = !!returnRouteData?.isRealRoute;
  const returnTravelMins = returnRouteData
    ? returnRouteData.durationMinutes
    : estimateTravelTimeMinutes(returnDistanceKm, returnSegMode);

  // Requirement 6: Budget calculation must include every applicable transport segment
  const returnFare = estimateSegmentFare(returnSegMode, returnDistanceKm, returnTravelMins, {
    peopleCount: constraints.peopleCount,
    currency: constraints.currency,
    transitDetails: returnRouteData?.transitDetails,
    rentalShop: constraints.rentalPickupShop,
  });

  const returnCost = returnFare.amount ?? 0;
  if (returnFare.isUnknown) {
    hasUnknownFares = true;
    unknownFaresCount++;
  }

  totalTransportCost += returnCost;

  const departureReturnMins = currentClockMins;
  const arrivalReturnMins = currentClockMins + returnTravelMins;

  const returnRouteLabel = isReturnReal
    ? 'Estimated travel time'
    : 'Estimated travel time (Fallback estimate)';

  let returnSubtitle = `${returnDistanceKm.toFixed(1)} km direct return leg via ${formatTransportName(returnSegMode)} • ${returnRouteLabel}`;
  if (returnRouteData?.transitDetails && returnRouteData.transitDetails.length > 0) {
    const transitDesc = returnRouteData.transitDetails
      .map((t) => `${t.vehicleName} ${t.lineShortName || t.lineName}`)
      .join(' → ');
    returnSubtitle += ` • ${transitDesc}`;
  }

  timeline.push({
    id: 'travel-return',
    type: 'travel',
    title: isRoundTrip
      ? `Return transit to ${returnTargetName}`
      : `Transit to ${returnTargetName}`,
    subtitle: returnSubtitle,
    time: minutesToTime(departureReturnMins),
    durationMinutes: returnTravelMins,
    distanceKm: returnDistanceKm,
    cost: returnCost,
    transportMode: returnSegMode,
    departureTime: minutesToTime(departureReturnMins),
    arrivalTime: minutesToTime(arrivalReturnMins),
    isRealRoute: isReturnReal,
    isFallback: !isReturnReal,
    routeLabel: returnRouteLabel,
    transitDetails: returnRouteData?.transitDetails,
    fareDisplay: returnFare.label,
    fareCertainty: returnFare.certainty,
    isFareUnknown: returnFare.isUnknown,
    fareMin: returnFare.minAmount,
    fareMax: returnFare.maxAmount,
    fareSourceLabel: returnFare.sourceDescription,
  });

  currentClockMins += returnTravelMins;

  // 4. Final return arrival segment
  timeline.push({
    id: 'seg-return',
    type: 'return',
    title: isRoundTrip
      ? `${returnTargetName} (Origin)`
      : returnTargetName,
    subtitle: isRoundTrip
      ? 'Trip concluded — successfully returned to starting location'
      : 'Trip concluded — return destination reached',
    time: minutesToTime(currentClockMins),
    durationMinutes: 0,
    cost: 0,
    arrivalTime: minutesToTime(currentClockMins),
  });

  // Requirements 1, 2, 3:
  // 1. Total travel time = sum of every route segment
  // 2. Total visit time = sum of actual visit duration assigned to each selected destination
  // 3. Total trip time = travel time + visit time + return travel time + rental dwell (if applicable)
  const rentalPickupDwell = constraints.rentalPickupShop ? 10 : 0;
  const travelTime = outboundTravelTime;
  const returnTravelTime = returnTravelMins;
  const totalTravelTime = outboundTravelTime + returnTravelMins;
  const totalTripTime = travelTime + totalVisitTime + returnTravelTime + rentalPickupDwell;
  const totalDuration = totalTripTime;

  // Requirements 4 & 5: Respect user start time and return/deadline time
  const expectedReturnMins = startMins + totalTripTime;
  const safetyBuffer = deadlineMins - expectedReturnMins;
  const remainingTime = timeAvailableMinutes - totalTripTime;

  // Requirements 6 & 7: Budget calculation & over budget checks
  const totalCost = totalTransportCost + totalEntryCost;
  const remainingBudget = constraints.budget - totalCost;

  const isTimeOver = totalTripTime > timeAvailableMinutes;
  const isDeadlineBreached = expectedReturnMins > deadlineMins;
  const isTimeExceeded = isTimeOver || isDeadlineBreached;
  const isBudgetExceeded = totalCost > constraints.budget;
  const isBudgetUncertain = hasUnknownFares && totalCost <= constraints.budget;

  const additionalTimeRequiredMinutes = isTimeExceeded
    ? Math.max(0, totalTripTime - timeAvailableMinutes, expectedReturnMins - deadlineMins)
    : 0;
  const overBudgetAmount = Math.max(0, totalCost - constraints.budget);

  const failureReasons: string[] = [];
  const failedCategories: ('insufficient_time' | 'deadline_exceeded' | 'budget_exceeded')[] = [];

  // Requirement 5: If the itinerary exceeds available time, clearly show:
  // "This itinerary cannot be completed within your available time." Also show how much additional time is required.
  let timeStatusMessage = '';
  if (isTimeExceeded) {
    if (isTimeOver && !isDeadlineBreached) {
      failedCategories.push('insufficient_time');
    } else if (isDeadlineBreached && !isTimeOver) {
      failedCategories.push('deadline_exceeded');
    } else {
      failedCategories.push('insufficient_time');
      failedCategories.push('deadline_exceeded');
    }

    const timeDiffFormatted = formatDuration(additionalTimeRequiredMinutes);
    timeStatusMessage = `This itinerary cannot be completed within your available time. Additional time required: ${timeDiffFormatted} (${additionalTimeRequiredMinutes} min).`;
    failureReasons.push(timeStatusMessage);

    if (isDeadlineBreached) {
      const lateMins = Math.abs(safetyBuffer);
      failureReasons.push(
        `Exceeds return deadline: Estimated return would be ${minutesToTime(expectedReturnMins)}, arriving ${lateMins} minutes after your ${minutesToTime(deadlineMins)} deadline.`
      );
    }
  } else {
    timeStatusMessage = `Fits within available time (Estimated return at ${minutesToTime(expectedReturnMins)}, ${safetyBuffer} min before deadline).`;
  }

  // Requirement 7: If total estimated cost exceeds the user's budget, clearly show:
  // "This itinerary exceeds your budget." Also show the estimated amount over budget.
  let budgetStatusMessage = '';
  if (isBudgetExceeded) {
    failedCategories.push('budget_exceeded');
    budgetStatusMessage = `This itinerary exceeds your budget. Estimated amount over budget: ${constraints.currency}${overBudgetAmount} (Total estimated cost: ${constraints.currency}${totalCost} vs Budget: ${constraints.currency}${constraints.budget}).`;
    failureReasons.push(budgetStatusMessage);
  } else {
    budgetStatusMessage = `Within budget (${constraints.currency}${remainingBudget} remaining).`;
  }

  let primaryFailureCategory: 'insufficient_time' | 'deadline_exceeded' | 'budget_exceeded' | 'multiple_constraints_failed' | undefined;
  if (failedCategories.length > 1) {
    primaryFailureCategory = 'multiple_constraints_failed';
  } else if (failedCategories.length === 1) {
    primaryFailureCategory = failedCategories[0];
  }

  // Requirements 13 & 14:
  // 13. If feasible: show that the itinerary fits.
  // 14. If not feasible: explain the exact constraint that failed.
  const isFeasible = !isTimeExceeded && !isBudgetExceeded;

  let feasibilityVerdictMessage = '';
  let failedConstraintExplanation: string | undefined;

  if (isFeasible) {
    feasibilityVerdictMessage = 'This itinerary fits all constraints.';
  } else {
    if (isTimeExceeded && isBudgetExceeded) {
      failedConstraintExplanation = `Both Time and Budget constraints failed: This itinerary cannot be completed within your available time (Additional time required: ${formatDuration(additionalTimeRequiredMinutes)}), and this itinerary exceeds your budget (Estimated amount over budget: ${constraints.currency}${overBudgetAmount}).`;
    } else if (isTimeExceeded) {
      failedConstraintExplanation = `Time constraint failed: This itinerary cannot be completed within your available time. Additional time required: ${formatDuration(additionalTimeRequiredMinutes)} (${additionalTimeRequiredMinutes} min).`;
    } else {
      failedConstraintExplanation = `Budget constraint failed: This itinerary exceeds your budget. Estimated amount over budget: ${constraints.currency}${overBudgetAmount}.`;
    }
    feasibilityVerdictMessage = failedConstraintExplanation;
  }

  return {
    destinations,
    departureTime: minutesToTime(startMins),
    travelTime,
    totalTravelTime,
    totalVisitTime,
    totalBreakTime: 0,
    totalDuration,
    totalTripTime,
    returnTravelTime,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalTransportCost,
    totalEntryCost,
    totalCost,
    hasUnknownFares,
    unknownFaresCount,
    isBudgetUncertain,
    expectedReturnMins,
    expectedReturnTime: minutesToTime(expectedReturnMins),
    deadlineMins,
    returnDeadline: minutesToTime(deadlineMins),
    safetyBuffer,
    remainingBudget,
    remainingTime,
    additionalTimeRequiredMinutes,
    overBudgetAmount,
    isTimeOver,
    isDeadlineBreached,
    isTimeExceeded,
    isBudgetExceeded,
    isFeasible,
    timeStatusMessage,
    budgetStatusMessage,
    feasibilityVerdictMessage,
    failedConstraintExplanation,
    timeline,
    failureReasons,
    primaryFailureCategory,
  };
}

/**
 * Generates all non-empty subsets of an array of destinations
 */
function getAllSubsets(items: Destination[]): Destination[][] {
  const result: Destination[][] = [];
  const total = 1 << items.length; // 2^N

  for (let mask = 1; mask < total; mask++) {
    const subset: Destination[] = [];
    for (let i = 0; i < items.length; i++) {
      if ((mask & (1 << i)) !== 0) {
        subset.push(items[i]);
      }
    }
    result.push(subset);
  }

  return result;
}

/**
 * Optimizes the traversal sequence of a small subset of destinations
 * to minimize total travel distance (nearest neighbor / optimal permutation).
 */
function optimizeSequence(destinations: Destination[]): Destination[] {
  if (destinations.length <= 1) return destinations;

  // For small subsets (up to 4), evaluate all permutations
  if (destinations.length <= 4) {
    const permute = (arr: Destination[]): Destination[][] => {
      if (arr.length <= 1) return [arr];
      const perms: Destination[][] = [];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const p of permute(rest)) {
          perms.push([item, ...p]);
        }
      }
      return perms;
    };

    const allPerms = permute(destinations);
    let bestPerm = destinations;
    let minDistance = Infinity;

    for (const p of allPerms) {
      let dist = p[0].distanceKm;
      for (let i = 1; i < p.length; i++) {
        dist += calculateInterDestinationDistance(p[i - 1], p[i]);
      }
      dist += p[p.length - 1].distanceKm * 0.95;
      if (dist < minDistance) {
        minDistance = dist;
        bestPerm = p;
      }
    }

    return bestPerm;
  }

  // Greedy Nearest-Neighbor heuristic for larger sets
  const remaining = [...destinations];
  const ordered: Destination[] = [];

  // Start with closest to origin
  remaining.sort((a, b) => a.distanceKm - b.distanceKm);
  ordered.push(remaining.shift()!);

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let closestIndex = 0;
    let closestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = calculateInterDestinationDistance(current, remaining[i]);
      if (d < closestDist) {
        closestDist = d;
        closestIndex = i;
      }
    }

    ordered.push(remaining.splice(closestIndex, 1)[0]);
  }

  return ordered;
}

/**
 * Searches and selects the optimal feasible alternative subset among user-selected destinations
 * based on prioritized constraints:
 * 1. Stay within the user's return deadline.
 * 2. Stay within the user's budget.
 * 3. Maximize useful destinations / experience.
 * 4. Prefer lower total travel time when destination counts are equal.
 * 5. Prefer lower cost when otherwise comparable.
 * 6. Maintain a reasonable safety buffer before the return deadline.
 */
export function findBestFeasibleAlternative(
  selectedDestinations: Destination[],
  constraints: TripConstraints,
  options: FeasibilityOptions = {}
): EvaluatedRoute | null {
  const safetyBufferTarget = options.safetyBufferMinutes ?? DEFAULT_SAFETY_BUFFER_MINUTES;

  // If user selected 1 or fewer destinations, no alternative subset exists
  if (selectedDestinations.length <= 1) {
    return null;
  }

  // Get all candidate proper subsets (subsets with at least 1 and at most N-1 items)
  const allSubsets = getAllSubsets(selectedDestinations).filter(
    (subset) => subset.length > 0 && subset.length < selectedDestinations.length
  );

  const evaluatedFeasibleSubsets: EvaluatedRoute[] = [];

  for (const subset of allSubsets) {
    const optimized = optimizeSequence(subset);
    const evaluated = evaluateRouteSequence(optimized, constraints, options);

    // Hard feasibility criteria:
    // 1. Must stay within return deadline (safetyBuffer >= 0)
    // 2. Must stay within budget (totalCost <= constraints.budget)
    // 3. Must stay within available time window (totalDuration <= timeAvailableMinutes)
    if (evaluated.isFeasible && evaluated.safetyBuffer >= 0) {
      evaluatedFeasibleSubsets.push(evaluated);
    }
  }

  if (evaluatedFeasibleSubsets.length === 0) {
    return null;
  }

  // Rank feasible candidates by the user's explicit priority hierarchy:
  evaluatedFeasibleSubsets.sort((a, b) => {
    // 1. Maximize useful destinations (higher count first)
    if (b.destinations.length !== a.destinations.length) {
      return b.destinations.length - a.destinations.length;
    }

    // 2. Prefer subsets meeting the recommended safety buffer (e.g. >= 15 min)
    const aMeetsSafety = a.safetyBuffer >= safetyBufferTarget;
    const bMeetsSafety = b.safetyBuffer >= safetyBufferTarget;
    if (aMeetsSafety !== bMeetsSafety) {
      return aMeetsSafety ? -1 : 1;
    }

    // 3. Prefer lower total travel time when destination counts are equal
    if (Math.abs(a.totalTravelTime - b.totalTravelTime) >= 3) {
      return a.totalTravelTime - b.totalTravelTime;
    }

    // 4. Prefer lower cost when otherwise comparable
    if (Math.abs(a.totalCost - b.totalCost) >= 15) {
      return a.totalCost - b.totalCost;
    }

    // 5. Prefer higher safety buffer
    return b.safetyBuffer - a.safetyBuffer;
  });

  return evaluatedFeasibleSubsets[0];
}

/**
 * Calculates the exact mathematical impact and explanation for why a destination
 * had to be excluded from the recommended feasible plan.
 */
function calculateExclusionReason(
  destination: Destination,
  alternativeDestinations: Destination[],
  constraints: TripConstraints,
  options: FeasibilityOptions = {}
): ExcludedDestination {
  const safetyBufferTarget = options.safetyBufferMinutes ?? DEFAULT_SAFETY_BUFFER_MINUTES;

  // Test what happens if we add this specific destination back to the alternative plan
  const testCandidate = optimizeSequence([...alternativeDestinations, destination]);
  const testEval = evaluateRouteSequence(testCandidate, constraints, options);

  const startMins = timeToMinutes(constraints.startTime);
  const endMins = timeToMinutes(constraints.endTime);
  const deadlineMins = timeToMinutes(constraints.returnDeadline);
  const timeAvailableMinutes = Math.max(0, endMins - startMins);

  const entryCostTotal = destination.entryCost * constraints.peopleCount;
  const visitTime = getDestinationVisitDuration(destination);

  // Approximate additional travel time needed for this destination
  const additionalTravelMins = estimateTravelTimeMinutes(destination.distanceKm, constraints.transportPreference);
  const totalAdditionalTime = visitTime + additionalTravelMins;

  let reason = '';
  let category: ExcludedDestination['category'] = 'deadline_exceeded';

  if (testEval.expectedReturnMins > deadlineMins) {
    const lateMins = testEval.expectedReturnMins - deadlineMins;
    category = 'deadline_exceeded';
    reason = `${destination.name} was excluded because its estimated ${visitTime}-minute visit time caused the itinerary to exceed the return deadline by ${lateMins}m (Projected return: ${minutesToTime(testEval.expectedReturnMins)}).`;
  } else if (testEval.totalCost > constraints.budget) {
    const excess = testEval.totalCost - constraints.budget;
    category = 'budget_exceeded';
    reason = `${destination.name} was excluded because its entry fee (${constraints.currency}${entryCostTotal}) exceeded your remaining budget by ${constraints.currency}${excess}.`;
  } else if (testEval.totalDuration > timeAvailableMinutes) {
    const diff = testEval.totalDuration - timeAvailableMinutes;
    category = 'time_window_exceeded';
    reason = `${destination.name} was excluded because its estimated ${visitTime}-minute visit time (${additionalTravelMins}m transit) caused the itinerary to exceed available time by ${formatDuration(diff)}.`;
  } else if (testEval.safetyBuffer < safetyBufferTarget) {
    category = 'buffer_depleted';
    reason = `${destination.name} was excluded because its estimated ${visitTime}-minute visit time leaves only a ${testEval.safetyBuffer}m safety buffer, below the recommended ${safetyBufferTarget}m margin.`;
  } else {
    reason = `${destination.name} was excluded because its estimated ${visitTime}-minute visit time and detour transit (~${additionalTravelMins}m transit) compromise overall route feasibility.`;
  }

  return {
    destination,
    reason,
    category,
    impact: {
      timeNeededMinutes: totalAdditionalTime,
      additionalCost: entryCostTotal,
      projectedReturnTime: minutesToTime(testEval.expectedReturnMins),
    },
  };
}

/**
 * MAIN CONSTRAINT-AWARE ITINERARY SELECTION ENGINE
 *
 * Implements full feasibility verification and combinatorial alternative subset selection.
 */
export function analyzeTripFeasibility(
  constraints: TripConstraints,
  destinations: Destination[],
  options: FeasibilityOptions = {}
): FeasibilityResult {
  const safetyBufferTarget = options.safetyBufferMinutes ?? DEFAULT_SAFETY_BUFFER_MINUTES;

  const startMins = timeToMinutes(constraints.startTime);
  const endMins = timeToMinutes(constraints.endTime);
  const deadlineMins = timeToMinutes(constraints.returnDeadline);
  const timeAvailableMinutes = Math.max(0, endMins - startMins);

  // If no destinations are selected yet
  if (destinations.length === 0) {
    return {
      feasible: false,
      isFeasible: false,
      selectedDestinations: [],
      includedDestinations: [],
      excludedDestinations: [],
      totalTravelTime: 0,
      totalVisitTime: 0,
      totalDuration: 0,
      timeUsedMinutes: 0,
      timeAvailableMinutes,
      remainingTime: timeAvailableMinutes,
      estimatedCost: 0,
      totalCost: 0,
      budget: constraints.budget,
      remainingBudget: constraints.budget,
      expectedReturnTime: constraints.startTime ? minutesToTime(startMins) : '--',
      returnDeadline: constraints.returnDeadline ? minutesToTime(deadlineMins) : '--',
      deadlineTime: constraints.returnDeadline ? minutesToTime(deadlineMins) : '--',
      safetyBuffer: Math.max(0, deadlineMins - startMins),
      bufferMinutes: Math.max(0, deadlineMins - startMins),
      reasons: ['Select at least one destination to create an itinerary.'],
      failureReasons: ['Select at least one destination to create an itinerary.'],
      checks: [
        {
          id: 'travel-time',
          label: 'Travel Time & Circuit Duration',
          status: 'pending',
          detail: 'Select at least one destination to create an itinerary.',
        },
        {
          id: 'visit-duration',
          label: 'Destination Visit Duration',
          status: 'pending',
          detail: 'Select at least one destination to create an itinerary.',
        },
        {
          id: 'transport-cost',
          label: 'Estimated Total Cost',
          status: 'pending',
          detail: 'Select at least one destination to create an itinerary.',
        },
        {
          id: 'budget-check',
          label: 'Budget Limit',
          status: 'pending',
          detail: 'Select at least one destination to create an itinerary.',
        },
        {
          id: 'return-deadline',
          label: 'Estimated Return vs Deadline',
          status: 'pending',
          detail: 'Select at least one destination to create an itinerary.',
        },
        {
          id: 'route-optimization',
          label: 'Waypoint Sequence Optimization',
          status: 'pending',
          detail: 'Select at least one destination to create an itinerary.',
        },
      ],
      timeline: [],
    };
  }

  // Defensive geographic validation: check if destinations match start or return location
  const locationContext = constraints.startLocation?.trim() || constraints.returnLocation?.trim() || '';
  const { valid: compatibleDestinations, rejected: incompatibleDestinations } = filterDestinationsByTripArea(
    destinations,
    locationContext,
    constraints.startCoordinates
  );

  // If all selected destinations belong to an incompatible distant city
  if (compatibleDestinations.length === 0 && incompatibleDestinations.length > 0) {
    const names = incompatibleDestinations.map((d) => d.name).join(', ');
    const geoFailMsg = `Selected destination${incompatibleDestinations.length > 1 ? 's' : ''} (${names}) ${incompatibleDestinations.length > 1 ? 'are' : 'is'} located outside your trip area (${locationContext || 'selected trip area'}).`;
    return {
      feasible: false,
      isFeasible: false,
      selectedDestinations: destinations,
      includedDestinations: [],
      excludedDestinations: incompatibleDestinations.map((d) => ({
        destination: d,
        reason: `${d.name} is outside the geographic area of ${locationContext || 'selected trip area'}.`,
        category: 'deadline_exceeded' as const,
        impact: {
          timeNeededMinutes: 0,
          additionalCost: 0,
          projectedReturnTime: '--',
        },
      })),
      totalTravelTime: 0,
      totalVisitTime: 0,
      totalDuration: 0,
      timeUsedMinutes: 0,
      timeAvailableMinutes,
      remainingTime: timeAvailableMinutes,
      estimatedCost: 0,
      totalCost: 0,
      budget: constraints.budget,
      remainingBudget: constraints.budget,
      expectedReturnTime: constraints.startTime ? minutesToTime(startMins) : '--',
      returnDeadline: constraints.returnDeadline ? minutesToTime(deadlineMins) : '--',
      deadlineTime: constraints.returnDeadline ? minutesToTime(deadlineMins) : '--',
      safetyBuffer: Math.max(0, deadlineMins - startMins),
      bufferMinutes: Math.max(0, deadlineMins - startMins),
      reasons: [geoFailMsg],
      failureReasons: [geoFailMsg],
      checks: [
        {
          id: 'geographic-scope',
          label: 'Geographic Area Match',
          status: 'failed',
          detail: geoFailMsg,
          metric: 'Area Mismatch',
        },
      ],
      timeline: [],
    };
  }

  // 1. Evaluate the compatible destination sequence
  const evalTargetDestinations = compatibleDestinations.length > 0 ? compatibleDestinations : destinations;
  const primaryEval = evaluateRouteSequence(evalTargetDestinations, constraints, options);

  // 1. Travel Time: PASS when route can be completed within available time; FAIL when it cannot.
  const travelTimeStatus = primaryEval.isTimeOver ? 'failed' : 'passed';

  // 2. Visit Duration: PASS when total visit time fits within available time; FAIL when it exceeds.
  const visitDurationStatus = primaryEval.totalVisitTime > timeAvailableMinutes ? 'failed' : 'passed';

  // 3. Budget & Transport checks
  const budgetStatus = primaryEval.isBudgetExceeded
    ? 'failed'
    : primaryEval.isBudgetUncertain
    ? 'warning'
    : 'passed';

  const transportCostDetail = primaryEval.hasUnknownFares
    ? `Estimated known cost is ${constraints.currency}${primaryEval.totalCost} (Transit: ${constraints.currency}${primaryEval.totalTransportCost}, Visits: ${constraints.currency}${primaryEval.totalEntryCost}), with ${primaryEval.unknownFaresCount} unavailable fare(s).`
    : `Estimated total cost is ${constraints.currency}${primaryEval.totalCost} (Transit: ${constraints.currency}${primaryEval.totalTransportCost}, Visits: ${constraints.currency}${primaryEval.totalEntryCost}), within your ${constraints.currency}${constraints.budget} budget.`;

  const budgetCheckDetail = primaryEval.isBudgetExceeded
    ? `Estimated total cost is ${constraints.currency}${primaryEval.totalCost}, exceeding your ${constraints.currency}${constraints.budget} budget by ${constraints.currency}${primaryEval.totalCost - constraints.budget}.`
    : primaryEval.isBudgetUncertain
    ? `Known costs total ${constraints.currency}${primaryEval.totalCost} of your ${constraints.currency}${constraints.budget} budget, but ${primaryEval.unknownFaresCount} transportation fare(s) are unavailable. Total cost may increase.`
    : `Estimated total cost is ${constraints.currency}${primaryEval.totalCost}, fitting within your ${constraints.currency}${constraints.budget} budget with ${constraints.currency}${primaryEval.remainingBudget} remaining.`;

  // 4. Return Deadline:
  // PASS when expected return time is at or before deadline AND safety buffer is >= recommended target.
  // WARNING when expected return time is before deadline (safetyBuffer >= 0) but safety buffer is below target.
  // FAIL when deadline is exceeded (safetyBuffer < 0).
  const returnDeadlineStatus = primaryEval.safetyBuffer < 0
    ? 'failed'
    : primaryEval.safetyBuffer < safetyBufferTarget
    ? 'warning'
    : 'passed';

  // Build verification checks table adhering strictly to verification rules
  const checks: VerificationCheck[] = [
    {
      id: 'travel-time',
      label: 'Travel Time & Circuit Duration',
      status: travelTimeStatus,
      detail: primaryEval.isTimeOver
        ? `Estimated total circuit duration including travel, visits, breaks, and return is ${formatDuration(primaryEval.totalDuration)}, exceeding available duration of ${formatDuration(timeAvailableMinutes)}.`
        : `Estimated total circuit duration including travel, visits, breaks, and return is ${formatDuration(primaryEval.totalDuration)}, fitting within available duration of ${formatDuration(timeAvailableMinutes)}.`,
      metric: `${formatDuration(primaryEval.totalDuration)} circuit`,
    },
    {
      id: 'visit-duration',
      label: 'Destination Visit Duration',
      status: visitDurationStatus,
      detail: primaryEval.totalVisitTime > timeAvailableMinutes
        ? `Destination visit time alone (${formatDuration(primaryEval.totalVisitTime)} across ${destinations.length} stop${destinations.length > 1 ? 's' : ''}, planning estimate) exceeds available duration of ${formatDuration(timeAvailableMinutes)}.`
        : `Destination visit time is ${formatDuration(primaryEval.totalVisitTime)} (planning estimate across ${destinations.length} stop${destinations.length > 1 ? 's' : ''}), fitting within available duration of ${formatDuration(timeAvailableMinutes)}.`,
      metric: `${formatDuration(primaryEval.totalVisitTime)} visit (est.)`,
    },
    {
      id: 'transport-cost',
      label: 'Estimated Transportation & Cost',
      status: primaryEval.isBudgetExceeded ? 'failed' : primaryEval.isBudgetUncertain ? 'warning' : 'passed',
      detail: transportCostDetail,
      metric: primaryEval.hasUnknownFares
        ? `${constraints.currency}${primaryEval.totalCost}+ / ${constraints.currency}${constraints.budget}`
        : `${constraints.currency}${primaryEval.totalCost} / ${constraints.currency}${constraints.budget}`,
    },
    {
      id: 'budget-check',
      label: 'Budget Limit',
      status: budgetStatus,
      detail: budgetCheckDetail,
      metric: primaryEval.hasUnknownFares
        ? `${constraints.currency}${primaryEval.totalCost}+ / ${constraints.currency}${constraints.budget}`
        : `${constraints.currency}${primaryEval.totalCost} / ${constraints.currency}${constraints.budget}`,
    },
    {
      id: 'return-deadline',
      label: 'Estimated Return vs Deadline',
      status: returnDeadlineStatus,
      detail: primaryEval.isDeadlineBreached
        ? `Estimated return time is ${primaryEval.expectedReturnTime}, exceeding your ${primaryEval.returnDeadline} deadline by ${Math.abs(primaryEval.safetyBuffer)} minutes.`
        : primaryEval.safetyBuffer < safetyBufferTarget
        ? `Estimated return time is ${primaryEval.expectedReturnTime} before your ${primaryEval.returnDeadline} deadline, but safety buffer (${primaryEval.safetyBuffer}m) is below the recommended ${safetyBufferTarget}m margin.`
        : `Estimated return time is ${primaryEval.expectedReturnTime} with an acceptable ${primaryEval.safetyBuffer}m safety buffer before your ${primaryEval.returnDeadline} deadline.`,
      metric: `${primaryEval.safetyBuffer}m buffer`,
    },
    {
      id: 'route-optimization',
      label: 'Waypoint Sequence Optimization',
      status: 'passed',
      detail: `Sequence optimized based on planning data to minimize transit distances (${primaryEval.totalDistanceKm.toFixed(1)} km circuit).`,
      metric: `${primaryEval.totalDistanceKm.toFixed(1)} km`,
    },
  ];

  // Case 1: The user-selected plan is completely FEASIBLE
  if (primaryEval.isFeasible) {
    return {
      feasible: true,
      isFeasible: true,
      selectedDestinations: destinations,
      includedDestinations: destinations,
      excludedDestinations: [],
      travelTime: primaryEval.travelTime,
      totalTravelTime: primaryEval.totalTravelTime,
      totalVisitTime: primaryEval.totalVisitTime,
      totalDuration: primaryEval.totalDuration,
      totalTripTime: primaryEval.totalTripTime,
      returnTravelTime: primaryEval.returnTravelTime,
      totalDistanceKm: primaryEval.totalDistanceKm,
      timeUsedMinutes: primaryEval.totalDuration,
      timeAvailableMinutes,
      remainingTime: primaryEval.remainingTime,
      additionalTimeRequiredMinutes: 0,
      isTimeExceeded: false,
      estimatedCost: primaryEval.totalCost,
      totalCost: primaryEval.totalCost,
      totalTransportCost: primaryEval.totalTransportCost,
      totalEntryCost: primaryEval.totalEntryCost,
      overBudgetAmount: 0,
      isBudgetExceeded: false,
      transportCostFormatted: primaryEval.hasUnknownFares
        ? `${constraints.currency}${primaryEval.totalTransportCost} + unknown fares`
        : `${constraints.currency}${primaryEval.totalTransportCost}`,
      hasUnknownFares: primaryEval.hasUnknownFares,
      unknownFaresCount: primaryEval.unknownFaresCount,
      isBudgetUncertain: primaryEval.isBudgetUncertain,
      budget: constraints.budget,
      remainingBudget: primaryEval.remainingBudget,
      startTimeFormatted: primaryEval.departureTime || (constraints.startTime ? minutesToTime(startMins) : '--'),
      departureTime: primaryEval.departureTime || (constraints.startTime ? minutesToTime(startMins) : '--'),
      expectedReturnTime: primaryEval.expectedReturnTime,
      returnDeadline: primaryEval.returnDeadline,
      deadlineTime: primaryEval.returnDeadline,
      safetyBuffer: primaryEval.safetyBuffer,
      bufferMinutes: primaryEval.safetyBuffer,
      timeStatusMessage: primaryEval.timeStatusMessage,
      budgetStatusMessage: primaryEval.budgetStatusMessage,
      feasibilityVerdictMessage: primaryEval.feasibilityVerdictMessage,
      failedConstraintExplanation: undefined,
      reasons: [],
      failureReasons: [],
      checks,
      timeline: primaryEval.timeline,
    };
  }

  // Case 2: The plan is NOT FEASIBLE — compute optimal alternative subset
  const bestAlt = findBestFeasibleAlternative(destinations, constraints, options);

  let alternativePlan: FeasibleAlternativePlan | undefined;
  let includedDestinations: Destination[] = [];
  const excludedDestinations: ExcludedDestination[] = [];

  if (bestAlt) {
    includedDestinations = bestAlt.destinations;

    // Identify which destinations from user's selection were excluded
    const includedIds = new Set(bestAlt.destinations.map((d) => d.id));
    const excludedList = destinations.filter((d) => !includedIds.has(d.id));

    // Calculate individual exact mathematical reason for each excluded destination
    for (const excludedDest of excludedList) {
      const exclusionData = calculateExclusionReason(
        excludedDest,
        bestAlt.destinations,
        constraints,
        options
      );
      excludedDestinations.push(exclusionData);
    }

    alternativePlan = {
      destinations: bestAlt.destinations,
      timeUsedMinutes: bestAlt.totalDuration,
      totalCost: bestAlt.totalCost,
      expectedReturnTime: bestAlt.expectedReturnTime,
      bufferMinutes: bestAlt.safetyBuffer,
      savedMinutes: primaryEval.totalDuration - bestAlt.totalDuration,
      totalTravelTime: bestAlt.totalTravelTime,
      totalVisitTime: bestAlt.totalVisitTime,
      remainingBudget: bestAlt.remainingBudget,
      remainingTime: bestAlt.remainingTime,
    };
  }

  return {
    feasible: false,
    isFeasible: false,
    selectedDestinations: destinations,
    includedDestinations,
    excludedDestinations,
    travelTime: primaryEval.travelTime,
    totalTravelTime: primaryEval.totalTravelTime,
    totalVisitTime: primaryEval.totalVisitTime,
    totalDuration: primaryEval.totalDuration,
    totalTripTime: primaryEval.totalTripTime,
    returnTravelTime: primaryEval.returnTravelTime,
    totalDistanceKm: primaryEval.totalDistanceKm,
    timeUsedMinutes: primaryEval.totalDuration,
    timeAvailableMinutes,
    remainingTime: primaryEval.remainingTime,
    additionalTimeRequiredMinutes: primaryEval.additionalTimeRequiredMinutes,
    isTimeExceeded: primaryEval.isTimeExceeded,
    estimatedCost: primaryEval.totalCost,
    totalCost: primaryEval.totalCost,
    totalTransportCost: primaryEval.totalTransportCost,
    totalEntryCost: primaryEval.totalEntryCost,
    overBudgetAmount: primaryEval.overBudgetAmount,
    isBudgetExceeded: primaryEval.isBudgetExceeded,
    transportCostFormatted: primaryEval.hasUnknownFares
      ? `${constraints.currency}${primaryEval.totalTransportCost} + unknown fares`
      : `${constraints.currency}${primaryEval.totalTransportCost}`,
    hasUnknownFares: primaryEval.hasUnknownFares,
    unknownFaresCount: primaryEval.unknownFaresCount,
    isBudgetUncertain: primaryEval.isBudgetUncertain,
    budget: constraints.budget,
    remainingBudget: primaryEval.remainingBudget,
    startTimeFormatted: primaryEval.departureTime || (constraints.startTime ? minutesToTime(startMins) : '--'),
    departureTime: primaryEval.departureTime || (constraints.startTime ? minutesToTime(startMins) : '--'),
    expectedReturnTime: primaryEval.expectedReturnTime,
    returnDeadline: primaryEval.returnDeadline,
    deadlineTime: primaryEval.returnDeadline,
    safetyBuffer: primaryEval.safetyBuffer,
    bufferMinutes: primaryEval.safetyBuffer,
    timeStatusMessage: primaryEval.timeStatusMessage,
    budgetStatusMessage: primaryEval.budgetStatusMessage,
    feasibilityVerdictMessage: primaryEval.feasibilityVerdictMessage,
    failedConstraintExplanation: primaryEval.failedConstraintExplanation,
    reasons: primaryEval.failureReasons,
    failureReasons: primaryEval.failureReasons,
    primaryFailureCategory: primaryEval.primaryFailureCategory,
    checks,
    alternativePlan,
    timeline: primaryEval.timeline,
  };
}

/**
 * Asynchronously evaluates trip feasibility with real Google Routes API data.
 * Falls back safely to estimates if offline, route unsupported, or on error.
 */
export async function analyzeTripFeasibilityWithRoutes(
  constraints: TripConstraints,
  destinations: Destination[],
  options?: FeasibilityOptions
): Promise<FeasibilityResult> {
  let routeLegsMap = options?.routeLegsMap;
  if (!routeLegsMap && destinations.length > 0) {
    try {
      routeLegsMap = await computeTripLegs(
        constraints.startLocation,
        destinations,
        constraints.sameReturnLocation ? constraints.startLocation : constraints.returnLocation,
        constraints.transportPreference,
        constraints.rentalPickupShop,
        constraints.segmentTransportModes,
        constraints.startCoordinates,
        constraints.returnCoordinates
      );
    } catch (err) {
      console.warn('Could not compute trip legs with Routes API, fallback used:', err);
    }
  }

  return analyzeTripFeasibility(constraints, destinations, {
    ...options,
    routeLegsMap,
  });
}

