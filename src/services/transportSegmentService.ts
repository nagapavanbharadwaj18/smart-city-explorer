import { Destination, TransportMode } from '../types';
import {
  computeRoute,
  calculateFallbackRoute,
  RouteWaypoint,
  RouteResult,
  TransitStepDetail,
  TransitRouteDetails,
  formatIsoTimeToDisplay,
} from './routesService';
import {
  estimateTwoWheelerSegmentFare,
  estimateCabSegmentFare,
  estimatePersonalDrivingFare,
  estimateWalkingFare,
  FareEstimate,
} from './fareService';

export interface TransitDisplayInfo {
  transitType: string;
  transitTypeLabel: string;
  routeLineName?: string;
  routeLineNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  departureStopName?: string;
  arrivalStopName?: string;
  stopCount?: number;
  transfersCount: number;
  transfersLabel: string;
  walkingPortions?: {
    totalDistanceMeters: number;
    totalDistanceFormatted: string;
    totalDurationMinutes: number;
    summary: string;
  };
  hasApiFare: boolean;
  apiFareFormatted?: string;
}

export interface TransportOptionInfo {
  mode: TransportMode;
  key: string;
  name: string;
  icon: string;
  durationMinutes: number;
  distanceKm: number;
  durationFormatted: string;
  estimatedFareFormatted: string;
  fareSourceLabel?: string;
  details?: string;
  plannedDepartureTimeFormatted?: string;
  plannedArrivalTimeFormatted?: string;
  transitDisplay?: TransitDisplayInfo;
  transitDetails?: TransitStepDetail[];
  isRealRoute: boolean;
  isFallback?: boolean;
  fallbackReason?: string;
  isRecommended?: boolean;
  recommendationTag?: string;
  fareEstimate?: FareEstimate;
}

export type WalkabilityLevel =
  | 'strongly_recommended'
  | 'recommended'
  | 'practical'
  | 'available_longer'
  | 'not_recommended';

export interface WalkabilityConfig {
  stronglyRecommendedMaxKm: number; // 0–1 km
  recommendedMaxKm: number;         // 1–2 km
  practicalMaxKm: number;           // 2–3 km
  availableMaxKm: number;           // 3–5 km
  stronglyRecommendedMaxMins: number; // ~18 min
  recommendedMaxMins: number;         // ~32 min
  practicalMaxMins: number;           // ~50 min
}

export const WALKABILITY_CONFIG: WalkabilityConfig = {
  stronglyRecommendedMaxKm: 1.0,
  recommendedMaxKm: 2.0,
  practicalMaxKm: 3.0,
  availableMaxKm: 5.0,
  stronglyRecommendedMaxMins: 18,
  recommendedMaxMins: 32,
  practicalMaxMins: 50,
};

export interface WalkabilityEvaluation {
  level: WalkabilityLevel;
  isRecommended: boolean;
  tag: string;
  note: string;
  displayTitle: string;
}

/**
 * Evaluates walkability for a segment using actual Google Routes walking distance and duration.
 * Adheres strictly to configurable walkability planning thresholds:
 * - 0–1 km: Strongly preferred (Walking — Recommended)
 * - 1–2 km: Prominently offered and normally preferred when practical (Walking — Recommended)
 * - 2–3 km: Available if practical alongside other options
 * - 3–5 km: Walking displayed if practical, faster options more prominent
 * - >5 km: Not normally recommended as primary option
 */
export function evaluateWalkability(
  walkRoute: RouteResult | null | undefined,
  config: WalkabilityConfig = WALKABILITY_CONFIG
): WalkabilityEvaluation {
  if (!walkRoute || walkRoute.distanceKm <= 0) {
    return {
      level: 'not_recommended',
      isRecommended: false,
      tag: 'No walking path',
      note: 'No pedestrian route available',
      displayTitle: 'Walking',
    };
  }

  const dist = walkRoute.distanceKm;
  const dur = walkRoute.durationMinutes;

  // 0–1 km: Walking strongly preferred
  if (dist <= config.stronglyRecommendedMaxKm && dur <= config.stronglyRecommendedMaxMins) {
    return {
      level: 'strongly_recommended',
      isRecommended: true,
      tag: 'Recommended for this short distance',
      note: 'Practical for this short distance',
      displayTitle: 'Walking — Recommended',
    };
  }

  // 1–2 km: Walking prominently offered and normally preferred for practical short route
  if (dist <= config.recommendedMaxKm && dur <= config.recommendedMaxMins) {
    return {
      level: 'recommended',
      isRecommended: true,
      tag: 'Recommended for this short distance',
      note: 'Practical for this short distance',
      displayTitle: 'Walking — Recommended',
    };
  }

  // 2–3 km: Practical walking option available alongside other options
  if (dist <= config.practicalMaxKm && dur <= config.practicalMaxMins) {
    return {
      level: 'practical',
      isRecommended: false,
      tag: 'Practical walking distance (₹0)',
      note: 'Walkable route with zero travel fare',
      displayTitle: 'Walking',
    };
  }

  // 3–5 km: Walking displayed if practical, but faster transportation presented more prominently
  if (dist <= config.availableMaxKm) {
    return {
      level: 'available_longer',
      isRecommended: false,
      tag: 'Extended walk',
      note: 'Longer walking route; faster transport available',
      displayTitle: 'Walking',
    };
  }

  // More than 5 km: Not normally recommended as primary option
  return {
    level: 'not_recommended',
    isRecommended: false,
    tag: 'Long distance',
    note: 'Long distance walk (motorized transport recommended)',
    displayTitle: 'Walking',
  };
}

export interface JourneySegment {
  id: string;
  index: number;
  fromName: string;
  toName: string;
  fromAddress: string;
  toAddress: string;
  fromCoords?: { latitude?: number; longitude?: number };
  toCoords?: { latitude?: number; longitude?: number };
  plannedDepartureDate?: string;
  plannedDepartureTimeFormatted?: string;
  availableOptions: TransportOptionInfo[];
  recommendedOption?: TransportOptionInfo;
  walkability?: WalkabilityEvaluation;
  selectedMode: TransportMode;
}

export interface TripSegmentAnalysis {
  segments: JourneySegment[];
  overallOptions: TransportOptionInfo[];
  summary: {
    totalSegments: number;
    hasMetro: boolean;
    hasBus: boolean;
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMins} min`;
}

/**
 * Analyzes each journey segment and determines which transportation options
 * are actually available based on Google Routes API data.
 * Recalculates transit and traffic-aware routing using each segment's actual planned departure time.
 */
export async function analyzeJourneySegments(
  startLocation: string,
  destinations: Destination[],
  returnLocation: string,
  startCoordinates?: { latitude?: number; longitude?: number },
  returnCoordinates?: { latitude?: number; longitude?: number },
  sameReturnLocation: boolean = true,
  tripStartTime?: string,
  segmentTransportModes?: Record<string, TransportMode>
): Promise<TripSegmentAnalysis> {
  if (!startLocation || destinations.length === 0) {
    return {
      segments: [],
      overallOptions: [],
      summary: { totalSegments: 0, hasMetro: false, hasBus: false },
    };
  }

  const waypoints: Array<{ name: string; address: string; lat?: number; lon?: number }> = [];

  // Start waypoint
  waypoints.push({
    name: startLocation,
    address: startLocation,
    lat: startCoordinates?.latitude,
    lon: startCoordinates?.longitude,
  });

  // Destinations
  for (const d of destinations) {
    waypoints.push({
      name: d.name,
      address: d.address || d.name,
      lat: d.latitude,
      lon: d.longitude,
    });
  }

  // Return waypoint: When round trip, strictly return to start hub with start coordinates
  const isRoundTrip = sameReturnLocation !== false;
  const resolvedReturn = isRoundTrip
    ? (startLocation || 'Start Location')
    : (returnLocation || startLocation || 'Return Location');
  const resolvedReturnCoords = isRoundTrip
    ? startCoordinates
    : (returnCoordinates || startCoordinates);

  waypoints.push({
    name: resolvedReturn,
    address: resolvedReturn,
    lat: resolvedReturnCoords?.latitude,
    lon: resolvedReturnCoords?.longitude,
  });

  const segments: JourneySegment[] = [];
  let foundMetroAnywhere = false;
  let foundBusAnywhere = false;

  // Base planned departure date from trip start time (e.g. "09:00")
  let currentDepartureDate = new Date();
  if (tripStartTime && tripStartTime.includes(':')) {
    const [h, m] = tripStartTime.split(':').map(Number);
    currentDepartureDate.setHours(h || 9, m || 0, 0, 0);
    // If earlier today by more than 3 hours, advance to tomorrow so daytime operating schedules apply
    if (currentDepartureDate.getTime() < Date.now() - 3 * 3600 * 1000) {
      currentDepartureDate.setDate(currentDepartureDate.getDate() + 1);
    }
  }

  // Process all consecutive segments sequentially using actual planned departure time
  for (let i = 0; i < waypoints.length - 1; i++) {
    const fromWp = waypoints[i];
    const toWp = waypoints[i + 1];

    const origin: RouteWaypoint = {
      name: fromWp.name,
      address: fromWp.address,
      latitude: fromWp.lat,
      longitude: fromWp.lon,
    };

    const destination: RouteWaypoint = {
      name: toWp.name,
      address: toWp.address,
      latitude: toWp.lat,
      longitude: toWp.lon,
    };

    const segDepartureDate = new Date(currentDepartureDate.getTime());
    const plannedDepartureTimeFormatted =
      formatIsoTimeToDisplay(segDepartureDate.toISOString()) ||
      segDepartureDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    // 1. Calculate available transport options using the actual planned departure time
    // For WALK, DRIVE, and TWO_WHEELER: use appropriate Routes API travel mode independently.
    // For TRANSIT: use actual transit routing at segDepartureDate.
    const [liveDriveRoute, liveTwoWRoute, liveTransitRoute, liveWalkRoute] = await Promise.all([
      computeRoute(origin, destination, 'DRIVE', segDepartureDate).catch(() => null),
      computeRoute(origin, destination, 'TWO_WHEELER', segDepartureDate).catch(() => null),
      computeRoute(origin, destination, 'TRANSIT', segDepartureDate).catch(() => null),
      computeRoute(origin, destination, 'WALK').catch(() => null),
    ]);

    // Independent route per mode with explicit fallback when live route is unavailable
    const finalWalkRoute =
      liveWalkRoute && liveWalkRoute.distanceKm > 0
        ? liveWalkRoute
        : calculateFallbackRoute(origin, destination, 'WALK');

    const finalTwoWRoute =
      liveTwoWRoute && liveTwoWRoute.distanceKm > 0
        ? liveTwoWRoute
        : calculateFallbackRoute(origin, destination, 'TWO_WHEELER');

    const finalDriveRoute =
      liveDriveRoute && liveDriveRoute.distanceKm > 0
        ? liveDriveRoute
        : calculateFallbackRoute(origin, destination, 'DRIVE');

    // Evaluate walkability using walking distance and duration
    const walkability = evaluateWalkability(finalWalkRoute);

    // 1. Walking Option (own walking route calculation)
    const walkFare = estimateWalkingFare();
    const walkOption: TransportOptionInfo = {
      mode: 'walking',
      key: `seg-${i}-walking`,
      name: walkability.isRecommended ? 'Walking — Recommended' : 'Walking',
      icon: '🚶',
      durationMinutes: finalWalkRoute.durationMinutes,
      distanceKm: finalWalkRoute.distanceKm,
      durationFormatted: formatDuration(finalWalkRoute.durationMinutes),
      estimatedFareFormatted: walkFare.formattedFare,
      fareSourceLabel: 'Free self-mobility (₹0)',
      details: walkability.note || 'Pedestrian route • Zero travel fare',
      plannedDepartureTimeFormatted,
      recommendationTag: walkability.tag,
      isRecommended: walkability.isRecommended,
      fareEstimate: walkFare,
      isRealRoute: finalWalkRoute.isRealRoute,
      isFallback: finalWalkRoute.isFallback,
      fallbackReason: finalWalkRoute.fallbackReason,
    };

    // 2. Metro Option (ONLY when actually available from real transit details with subway/metro)
    let metroOption: TransportOptionInfo | null = null;
    if (liveTransitRoute?.isRealRoute && liveTransitRoute.transitRouteDetails?.hasSubway) {
      const td = liveTransitRoute.transitRouteDetails;
      const metroStep = td.transitSteps.find(
        (t) => t.vehicleType === 'SUBWAY' || t.vehicleType === 'METRO_RAIL'
      );
      if (metroStep) {
        foundMetroAnywhere = true;
        const lineName = metroStep.lineShortName || metroStep.lineName;
        const depTime = metroStep.departureTime || td.departureTimeFormatted || plannedDepartureTimeFormatted;
        const arrTime = metroStep.arrivalTime || td.arrivalTimeFormatted;
        const stops =
          metroStep.departureStopName && metroStep.arrivalStopName
            ? `${metroStep.departureStopName} → ${metroStep.arrivalStopName}`
            : undefined;
        const stopCount = metroStep.stopCount ? `${metroStep.stopCount} stops` : undefined;
        const serviceDetails = [lineName, stops, stopCount].filter(Boolean).join(' • ');

        // Fare handling: NEVER invent fare if API did not provide it
        let fareFormatted = 'Fare unlisted by agency';
        let fareLabel = 'Official transit agency fare (Routes API)';
        let metroFareEstimate: FareEstimate;

        if (td.hasApiFare && td.apiFare) {
          fareFormatted = td.apiFare.formattedFare;
          metroFareEstimate = {
            certainty: 'exact',
            amount: Number(td.apiFare.units) || undefined,
            minAmount: Number(td.apiFare.units) || undefined,
            maxAmount: Number(td.apiFare.units) || undefined,
            currency: td.apiFare.currencyCode === 'INR' ? '₹' : td.apiFare.currencyCode,
            formattedFare: td.apiFare.formattedFare,
            label: `Official metro fare: ${td.apiFare.formattedFare}`,
            sourceDescription: 'Official transit agency fare (Routes API)',
            isUnknown: false,
          };
        } else {
          fareFormatted = 'Fare unlisted by agency';
          fareLabel = 'Agency fare not provided by API • Pay at counter/smart card';
          metroFareEstimate = {
            certainty: 'unavailable',
            currency: '₹',
            formattedFare: 'Fare unlisted by agency',
            label: 'Fare unlisted by agency (Pay at counter/smart card)',
            sourceDescription: 'Transit agency did not return fare data to API',
            isUnknown: true,
          };
        }

        const transitDisplay: TransitDisplayInfo = {
          transitType: metroStep.vehicleType,
          transitTypeLabel: 'Metro Rail',
          routeLineName: metroStep.lineName,
          routeLineNumber: metroStep.lineShortName,
          departureTime: depTime,
          arrivalTime: arrTime,
          departureStopName: metroStep.departureStopName,
          arrivalStopName: metroStep.arrivalStopName,
          stopCount: metroStep.stopCount,
          transfersCount: td.transfersCount,
          transfersLabel:
            td.transfersCount === 0 ? 'Direct • 0 transfers' : `${td.transfersCount} transfer${td.transfersCount > 1 ? 's' : ''}`,
          walkingPortions:
            td.totalWalkingDistanceKm > 0
              ? {
                  totalDistanceMeters: Math.round(td.totalWalkingDistanceKm * 1000),
                  totalDistanceFormatted: `${Math.round(td.totalWalkingDistanceKm * 1000)} m`,
                  totalDurationMinutes: td.totalWalkingMinutes,
                  summary: `Walk ~${Math.round(td.totalWalkingDistanceKm * 1000)}m to/from metro stations`,
                }
              : undefined,
          hasApiFare: td.hasApiFare,
          apiFareFormatted: td.apiFare?.formattedFare,
        };

        metroOption = {
          mode: 'metro',
          key: `seg-${i}-metro`,
          name: lineName ? `Metro (${lineName})` : 'Metro Rail',
          icon: '🚇',
          durationMinutes: liveTransitRoute.durationMinutes,
          distanceKm: liveTransitRoute.distanceKm,
          durationFormatted: formatDuration(liveTransitRoute.durationMinutes),
          estimatedFareFormatted: fareFormatted,
          fareSourceLabel: fareLabel,
          details: serviceDetails || 'Confirmed scheduled metro rail line',
          plannedDepartureTimeFormatted: depTime,
          plannedArrivalTimeFormatted: arrTime,
          transitDisplay,
          transitDetails: td.transitSteps,
          fareEstimate: metroFareEstimate,
          isRealRoute: true,
          isFallback: false,
          isRecommended:
            !walkability.isRecommended && liveTransitRoute.durationMinutes <= finalDriveRoute.durationMinutes + 12,
          recommendationTag: !walkability.isRecommended ? 'Fast metro transit' : undefined,
        };
      }
    }

    // 3. City Bus / Public Transit Option (ONLY when actual bus/train transit data is available)
    let busOption: TransportOptionInfo | null = null;
    if (liveTransitRoute?.isRealRoute && liveTransitRoute.transitRouteDetails?.hasBus) {
      const td = liveTransitRoute.transitRouteDetails;
      const busStep =
        td.transitSteps.find(
          (t) => t.vehicleType === 'BUS' || t.vehicleType === 'TRAIN' || t.vehicleType === 'TRAM'
        ) || td.transitSteps[0];

      if (busStep) {
        foundBusAnywhere = true;
        const lineName = busStep.lineShortName || busStep.lineName;
        const depTime = busStep.departureTime || td.departureTimeFormatted || plannedDepartureTimeFormatted;
        const arrTime = busStep.arrivalTime || td.arrivalTimeFormatted;
        const stops =
          busStep.departureStopName && busStep.arrivalStopName
            ? `${busStep.departureStopName} → ${busStep.arrivalStopName}`
            : undefined;
        const stopCount = busStep.stopCount ? `${busStep.stopCount} stops` : undefined;
        const serviceDetails = [lineName, stops, stopCount].filter(Boolean).join(' • ');

        let fareFormatted = 'Fare unlisted by agency';
        let fareLabel = 'Official transit agency fare (Routes API)';
        let busFareEstimate: FareEstimate;

        if (td.hasApiFare && td.apiFare) {
          fareFormatted = td.apiFare.formattedFare;
          busFareEstimate = {
            certainty: 'exact',
            amount: Number(td.apiFare.units) || undefined,
            minAmount: Number(td.apiFare.units) || undefined,
            maxAmount: Number(td.apiFare.units) || undefined,
            currency: td.apiFare.currencyCode === 'INR' ? '₹' : td.apiFare.currencyCode,
            formattedFare: td.apiFare.formattedFare,
            label: `Official bus fare: ${td.apiFare.formattedFare}`,
            sourceDescription: 'Official transit agency fare (Routes API)',
            isUnknown: false,
          };
        } else {
          fareFormatted = 'Fare unlisted by agency';
          fareLabel = 'Agency fare not provided by API • Pay onboard conductor';
          busFareEstimate = {
            certainty: 'unavailable',
            currency: '₹',
            formattedFare: 'Fare unlisted by agency',
            label: 'Fare unlisted by agency (Pay conductor onboard)',
            sourceDescription: 'Transit agency did not return fare data to API',
            isUnknown: true,
          };
        }

        const transitDisplay: TransitDisplayInfo = {
          transitType: busStep.vehicleType,
          transitTypeLabel:
            busStep.vehicleType === 'TRAIN'
              ? 'Suburban Train'
              : busStep.vehicleType === 'TRAM'
              ? 'City Tram'
              : 'City Bus',
          routeLineName: busStep.lineName,
          routeLineNumber: busStep.lineShortName,
          departureTime: depTime,
          arrivalTime: arrTime,
          departureStopName: busStep.departureStopName,
          arrivalStopName: busStep.arrivalStopName,
          stopCount: busStep.stopCount,
          transfersCount: td.transfersCount,
          transfersLabel:
            td.transfersCount === 0 ? 'Direct • 0 transfers' : `${td.transfersCount} transfer${td.transfersCount > 1 ? 's' : ''}`,
          walkingPortions:
            td.totalWalkingDistanceKm > 0
              ? {
                  totalDistanceMeters: Math.round(td.totalWalkingDistanceKm * 1000),
                  totalDistanceFormatted: `${Math.round(td.totalWalkingDistanceKm * 1000)} m`,
                  totalDurationMinutes: td.totalWalkingMinutes,
                  summary: `Walk ~${Math.round(td.totalWalkingDistanceKm * 1000)}m to/from bus stops`,
                }
              : undefined,
          hasApiFare: td.hasApiFare,
          apiFareFormatted: td.apiFare?.formattedFare,
        };

        busOption = {
          mode: 'bus',
          key: `seg-${i}-bus`,
          name: lineName ? `City Bus (${lineName})` : 'City Bus',
          icon: busStep.vehicleType === 'TRAIN' ? '🚆' : '🚌',
          durationMinutes: liveTransitRoute.durationMinutes,
          distanceKm: liveTransitRoute.distanceKm,
          durationFormatted: formatDuration(liveTransitRoute.durationMinutes),
          estimatedFareFormatted: fareFormatted,
          fareSourceLabel: fareLabel,
          details: serviceDetails || 'Scheduled public transit route',
          plannedDepartureTimeFormatted: depTime,
          plannedArrivalTimeFormatted: arrTime,
          transitDisplay,
          transitDetails: td.transitSteps,
          fareEstimate: busFareEstimate,
          isRealRoute: true,
          isFallback: false,
          isRecommended: false,
        };
      }
    }

    // 4. Two-Wheeler Option (own two-wheeler route calculation with traffic awareness)
    const twoWFare = estimateTwoWheelerSegmentFare(finalTwoWRoute.distanceKm, finalTwoWRoute.durationMinutes);
    const twoWOption: TransportOptionInfo = {
      mode: 'two_wheeler',
      key: `seg-${i}-two_wheeler`,
      name: 'Two-wheeler',
      icon: '🏍️',
      durationMinutes: finalTwoWRoute.durationMinutes,
      distanceKm: finalTwoWRoute.distanceKm,
      durationFormatted: formatDuration(finalTwoWRoute.durationMinutes),
      estimatedFareFormatted: twoWFare.formattedFare,
      fareSourceLabel: 'Approximate estimate (Check Rapido/Ola for live fare)',
      details: 'Agile city transit • Low traffic congestion delay',
      plannedDepartureTimeFormatted,
      fareEstimate: twoWFare,
      isRealRoute: finalTwoWRoute.isRealRoute,
      isFallback: finalTwoWRoute.isFallback,
      fallbackReason: finalTwoWRoute.fallbackReason,
      isRecommended: !walkability.isRecommended && !metroOption?.isRecommended && finalTwoWRoute.distanceKm <= 8,
      recommendationTag:
        !walkability.isRecommended && !metroOption?.isRecommended && finalTwoWRoute.distanceKm <= 8
          ? 'Fast city transit'
          : undefined,
    };

    // 5. Taxi / Ride-hailing Option (approximate estimate; user should check provider app)
    const cabFare = estimateCabSegmentFare(finalDriveRoute.distanceKm, finalDriveRoute.durationMinutes);
    const taxiOption: TransportOptionInfo = {
      mode: 'auto_cab',
      key: `seg-${i}-auto_cab`,
      name: 'Taxi / Ride-hailing',
      icon: '🚕',
      durationMinutes: finalDriveRoute.durationMinutes,
      distanceKm: finalDriveRoute.distanceKm,
      durationFormatted: formatDuration(finalDriveRoute.durationMinutes),
      estimatedFareFormatted: cabFare.formattedFare,
      fareSourceLabel: 'Approximate estimate (Check Uber/Ola/Auto app for live fare & surge)',
      details: 'On-demand cab/auto • Door-to-door comfort',
      plannedDepartureTimeFormatted,
      fareEstimate: cabFare,
      isRealRoute: finalDriveRoute.isRealRoute,
      isFallback: finalDriveRoute.isFallback,
      fallbackReason: finalDriveRoute.fallbackReason,
      isRecommended: !walkability.isRecommended && !metroOption?.isRecommended && !twoWOption.isRecommended,
    };

    // 6. Driving Option (personal vehicle / car fuel estimate)
    const driveFare = estimatePersonalDrivingFare(finalDriveRoute.distanceKm, finalDriveRoute.durationMinutes);
    const driveOption: TransportOptionInfo = {
      mode: 'driving',
      key: `seg-${i}-driving`,
      name: 'Driving',
      icon: '🚗',
      durationMinutes: finalDriveRoute.durationMinutes,
      distanceKm: finalDriveRoute.distanceKm,
      durationFormatted: formatDuration(finalDriveRoute.durationMinutes),
      estimatedFareFormatted: driveFare.formattedFare,
      fareSourceLabel: 'Estimated personal driving fuel cost (~₹8–₹12/km)',
      details: 'Direct road route • Traffic-aware vehicle navigation',
      plannedDepartureTimeFormatted,
      fareEstimate: driveFare,
      isRealRoute: finalDriveRoute.isRealRoute,
      isFallback: finalDriveRoute.isFallback,
      fallbackReason: finalDriveRoute.fallbackReason,
      isRecommended: false,
    };

    // Assemble available options independently for this segment
    // Notice: Metro and Bus are included ONLY when actually available from API
    const availableOptions: TransportOptionInfo[] = [];
    if (walkability.isRecommended) {
      availableOptions.push(walkOption);
      if (metroOption) availableOptions.push(metroOption);
      if (busOption) availableOptions.push(busOption);
      availableOptions.push(twoWOption);
      availableOptions.push(taxiOption);
      availableOptions.push(driveOption);
    } else {
      if (metroOption) availableOptions.push(metroOption);
      availableOptions.push(twoWOption);
      availableOptions.push(taxiOption);
      if (busOption) availableOptions.push(busOption);
      availableOptions.push(driveOption);
      availableOptions.push(walkOption);
    }

    // Determine the recommended option for this segment
    const recommendedOption: TransportOptionInfo = walkability.isRecommended
      ? walkOption
      : metroOption && metroOption.isRecommended
      ? metroOption
      : twoWOption.isRecommended
      ? twoWOption
      : taxiOption;

    segments.push({
      id: `seg-${i}`,
      index: i,
      fromName: fromWp.name,
      toName: toWp.name,
      fromAddress: fromWp.address,
      toAddress: toWp.address,
      fromCoords: fromWp.lat ? { latitude: fromWp.lat, longitude: fromWp.lon } : undefined,
      toCoords: toWp.lat ? { latitude: toWp.lat, longitude: toWp.lon } : undefined,
      plannedDepartureDate: segDepartureDate.toISOString(),
      plannedDepartureTimeFormatted,
      availableOptions,
      recommendedOption,
      walkability,
      selectedMode: recommendedOption.mode,
    });

    // Advance currentDepartureDate for next segment based on chosen/active travel time + visit duration
    const activeMode = segmentTransportModes?.[`seg-${i}`] || recommendedOption.mode;
    const activeOption = availableOptions.find((o) => o.mode === activeMode) || recommendedOption;
    const travelMinutes = activeOption.durationMinutes || 15;

    const destIdx = i; // waypoints[0] is start, waypoints[1] is destination 0, etc.
    const destObj = destinations[destIdx];
    const visitMinutes = destObj ? (destObj.visitDurationMinutes || 30) : 0;

    currentDepartureDate = new Date(
      currentDepartureDate.getTime() + (travelMinutes + visitMinutes) * 60 * 1000
    );
  }

  // Aggregate overall journey options across segments for the 4 primary modes
  const overallOptions: TransportOptionInfo[] = [];

  // Helper to extract a segment's specific mode option
  const getSegOption = (seg: JourneySegment, mode: TransportMode): TransportOptionInfo => {
    return (
      seg.availableOptions.find((o) => o.mode === mode) ||
      seg.availableOptions.find(
        (o) =>
          (mode === 'driving' && o.mode === 'auto_cab') ||
          (mode === 'auto_cab' && o.mode === 'driving') ||
          (mode === 'public_transport' && (o.mode === 'metro' || o.mode === 'bus'))
      ) ||
      seg.availableOptions[0]
    );
  };

  // 1. WALKING
  const totalWalkMins = segments.reduce((sum, s) => sum + getSegOption(s, 'walking').durationMinutes, 0);
  const totalWalkDist =
    Math.round(segments.reduce((sum, s) => sum + getSegOption(s, 'walking').distanceKm, 0) * 10) / 10;
  const isAllWalkReal = segments.every((s) => getSegOption(s, 'walking').isRealRoute);
  const walkFare = estimateWalkingFare();
  const isWholeJourneyWalkRecommended =
    segments.length > 0 &&
    segments.every((s) => s.walkability?.isRecommended) &&
    totalWalkDist <= 4.0;

  overallOptions.push({
    mode: 'walking',
    key: 'walking',
    name: isWholeJourneyWalkRecommended ? 'Walking — Recommended' : 'Walking',
    icon: '🚶',
    durationMinutes: totalWalkMins,
    distanceKm: totalWalkDist,
    durationFormatted: formatDuration(totalWalkMins),
    estimatedFareFormatted: walkFare.formattedFare,
    fareSourceLabel: 'Free self-mobility (₹0)',
    details: isWholeJourneyWalkRecommended
      ? 'Practical short-distance circuit • ₹0'
      : totalWalkDist > 6
      ? 'Extended pedestrian circuit • High physical activity'
      : 'Continuous walking path across all stops',
    recommendationTag: isWholeJourneyWalkRecommended
      ? 'Recommended for short distance'
      : undefined,
    isRecommended: isWholeJourneyWalkRecommended,
    fareEstimate: walkFare,
    isRealRoute: isAllWalkReal,
    isFallback: !isAllWalkReal,
    fallbackReason: isAllWalkReal ? undefined : 'Walking distance estimated from street coordinates',
  });

  // 2. TWO-WHEELER
  const totalTwoWMins = segments.reduce((sum, s) => sum + getSegOption(s, 'two_wheeler').durationMinutes, 0);
  const totalTwoWDist =
    Math.round(segments.reduce((sum, s) => sum + getSegOption(s, 'two_wheeler').distanceKm, 0) * 10) / 10;
  const isAllTwoWReal = segments.every((s) => getSegOption(s, 'two_wheeler').isRealRoute);
  
  // Sum individual segment costs across every travel segment
  const twoWSegFares = segments.map((s) => getSegOption(s, 'two_wheeler').fareEstimate);
  const totalTwoWMin = twoWSegFares.reduce((sum, f) => sum + (f?.minAmount ?? 0), 0);
  const totalTwoWMax = twoWSegFares.reduce((sum, f) => sum + (f?.maxAmount ?? 0), 0);
  const totalTwoWAmount = twoWSegFares.reduce((sum, f) => sum + (f?.amount ?? 0), 0);
  const twoWFare: FareEstimate = {
    certainty: 'estimated',
    minAmount: totalTwoWMin,
    maxAmount: totalTwoWMax,
    amount: totalTwoWAmount,
    currency: '₹',
    formattedFare: `₹${totalTwoWMin}–₹${totalTwoWMax}`,
    label: `Estimated two-wheeler fare: ₹${totalTwoWMin}–₹${totalTwoWMax}`,
    sourceDescription: 'Sum of segment-by-segment estimates',
    isUnknown: false,
  };

  overallOptions.push({
    mode: 'two_wheeler',
    key: 'two_wheeler',
    name: 'Two-wheeler',
    icon: '🏍️',
    durationMinutes: totalTwoWMins,
    distanceKm: totalTwoWDist,
    durationFormatted: formatDuration(totalTwoWMins),
    estimatedFareFormatted: twoWFare.formattedFare,
    fareSourceLabel: 'Estimated two-wheeler fare (sum of segments)',
    details: 'Fast & agile city mobility with low transit congestion delay',
    fareEstimate: twoWFare,
    isRecommended: !isWholeJourneyWalkRecommended && totalTwoWDist <= 12,
    isRealRoute: isAllTwoWReal,
    isFallback: !isAllTwoWReal,
    fallbackReason: isAllTwoWReal ? undefined : 'Two-wheeler route estimated from street network speeds',
  });

  // 3. DRIVING
  const totalDriveMins = segments.reduce((sum, s) => sum + getSegOption(s, 'driving').durationMinutes, 0);
  const totalDriveDist =
    Math.round(segments.reduce((sum, s) => sum + getSegOption(s, 'driving').distanceKm, 0) * 10) / 10;
  const isAllDriveReal = segments.every((s) => getSegOption(s, 'driving').isRealRoute);
  
  // Sum individual segment costs across every driving segment
  const driveSegFares = segments.map((s) => getSegOption(s, 'driving').fareEstimate);
  const totalDriveMin = driveSegFares.reduce((sum, f) => sum + (f?.minAmount ?? 0), 0);
  const totalDriveMax = driveSegFares.reduce((sum, f) => sum + (f?.maxAmount ?? 0), 0);
  const totalDriveAmount = driveSegFares.reduce((sum, f) => sum + (f?.amount ?? 0), 0);
  const driveFare: FareEstimate = {
    certainty: 'estimated',
    minAmount: totalDriveMin,
    maxAmount: totalDriveMax,
    amount: totalDriveAmount,
    currency: '₹',
    formattedFare: `₹${totalDriveMin}–₹${totalDriveMax}`,
    label: `Estimated driving fare: ₹${totalDriveMin}–₹${totalDriveMax}`,
    sourceDescription: 'Sum of segment-by-segment estimates',
    isUnknown: false,
  };

  overallOptions.push({
    mode: 'driving',
    key: 'driving',
    name: 'Driving',
    icon: '🚗',
    durationMinutes: totalDriveMins,
    distanceKm: totalDriveDist,
    durationFormatted: formatDuration(totalDriveMins),
    estimatedFareFormatted: driveFare.formattedFare,
    fareSourceLabel: 'Estimated personal driving fuel cost (~₹8–₹12/km)',
    details: 'Direct road route • Traffic-aware vehicle navigation',
    fareEstimate: driveFare,
    isRecommended: false,
    isRealRoute: isAllDriveReal,
    isFallback: !isAllDriveReal,
    fallbackReason: isAllDriveReal ? undefined : 'Driving route estimated from street network geometry',
  });

  // 3b. TAXI / RIDE-HAILING
  const totalCabMins = segments.reduce((sum, s) => sum + getSegOption(s, 'auto_cab').durationMinutes, 0);
  const totalCabDist =
    Math.round(segments.reduce((sum, s) => sum + getSegOption(s, 'auto_cab').distanceKm, 0) * 10) / 10;
  const isAllCabReal = segments.every((s) => getSegOption(s, 'auto_cab').isRealRoute);
  const cabSegFares = segments.map((s) => getSegOption(s, 'auto_cab').fareEstimate);
  const totalCabMin = cabSegFares.reduce((sum, f) => sum + (f?.minAmount ?? 0), 0);
  const totalCabMax = cabSegFares.reduce((sum, f) => sum + (f?.maxAmount ?? 0), 0);
  const totalCabAmount = cabSegFares.reduce((sum, f) => sum + (f?.amount ?? 0), 0);
  const cabFare: FareEstimate = {
    certainty: 'estimated',
    minAmount: totalCabMin,
    maxAmount: totalCabMax,
    amount: totalCabAmount,
    currency: '₹',
    formattedFare: `~₹${totalCabMin}–₹${totalCabMax}`,
    label: `Approximate ride-hailing estimate: ₹${totalCabMin}–₹${totalCabMax} (Check provider apps for live fare)`,
    sourceDescription: 'Sum of segment-by-segment ride-hailing estimates (Check Uber/Ola/Auto app for live fare)',
    isUnknown: false,
  };

  overallOptions.push({
    mode: 'auto_cab',
    key: 'auto_cab',
    name: 'Taxi / Ride-hailing',
    icon: '🚕',
    durationMinutes: totalCabMins,
    distanceKm: totalCabDist,
    durationFormatted: formatDuration(totalCabMins),
    estimatedFareFormatted: cabFare.formattedFare,
    fareSourceLabel: 'Approximate ride-hailing estimate (Check provider app)',
    details: 'Door-to-door comfort • Check Uber/Ola/Auto app for live fare',
    fareEstimate: cabFare,
    isRecommended: false,
    isRealRoute: isAllCabReal,
    isFallback: !isAllCabReal,
  });

  // 4. TRANSIT (only included in overall options if transit is actually available)
  if (foundMetroAnywhere || foundBusAnywhere) {
    const totalTransitMins = segments.reduce((sum, s) => sum + getSegOption(s, 'public_transport').durationMinutes, 0);
    const totalTransitDist =
      Math.round(segments.reduce((sum, s) => sum + getSegOption(s, 'public_transport').distanceKm, 0) * 10) / 10;
    const isAllTransitReal = segments.every((s) => getSegOption(s, 'public_transport').isRealRoute);
    
    // Sum individual segment transit costs across every segment
    const transitSegFares = segments.map((s) => getSegOption(s, 'public_transport').fareEstimate);
    const totalTransitMin = transitSegFares.reduce((sum, f) => sum + (f?.minAmount ?? 0), 0);
    const totalTransitMax = transitSegFares.reduce((sum, f) => sum + (f?.maxAmount ?? 0), 0);
    const totalTransitAmount = transitSegFares.reduce((sum, f) => sum + (f?.amount ?? 0), 0);
    const hasAnyApiFare = segments.some((s) => getSegOption(s, 'public_transport').transitDisplay?.hasApiFare);

    const transitFare: FareEstimate = {
      certainty: hasAnyApiFare ? 'estimated' : 'unavailable',
      minAmount: totalTransitMin,
      maxAmount: totalTransitMax,
      amount: totalTransitAmount,
      currency: '₹',
      formattedFare: totalTransitMin > 0 ? `₹${totalTransitMin}–₹${totalTransitMax}` : 'Fare unlisted by agency',
      label: totalTransitMin > 0 ? `Estimated transit fare: ₹${totalTransitMin}–₹${totalTransitMax}` : 'Agency fares unlisted',
      sourceDescription: hasAnyApiFare ? 'Sum of segment-by-segment transit fares' : 'Transit agency does not publish live fares to API',
      isUnknown: !hasAnyApiFare,
    };

    overallOptions.push({
      mode: 'public_transport',
      key: 'public_transport',
      name: 'Transit',
      icon: foundMetroAnywhere ? '🚇' : '🚌',
      durationMinutes: totalTransitMins,
      distanceKm: totalTransitDist,
      durationFormatted: formatDuration(totalTransitMins),
      estimatedFareFormatted: transitFare.formattedFare,
      fareSourceLabel: 'City transit network fare (sum of segments)',
      details: foundMetroAnywhere
        ? 'Metro & connecting transit network'
        : foundBusAnywhere
        ? 'City bus routes & transit network'
        : 'Public transit route network',
      fareEstimate: transitFare,
      isRecommended: false,
      isRealRoute: isAllTransitReal,
      isFallback: !isAllTransitReal,
      fallbackReason: isAllTransitReal ? undefined : 'Transit schedule estimated from city transit corridors',
    });
  }

  return {
    segments,
    overallOptions,
    summary: {
      totalSegments: segments.length,
      hasMetro: foundMetroAnywhere,
      hasBus: foundBusAnywhere,
    },
  };
}
