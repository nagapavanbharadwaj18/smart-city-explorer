// Source: Google Maps Platform Code Assist & Live Geodesic Multi-Mode Routing System
import { TransportMode, Destination } from '../types';

export type RouteTravelMode = 'DRIVE' | 'TWO_WHEELER' | 'TRANSIT' | 'WALK' | 'BICYCLE';

export interface RouteWaypoint {
  address?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  name?: string;
}

export interface RouteGeometryPoint {
  latitude: number;
  longitude: number;
}

export interface TransitStepDetail {
  vehicleType: 'BUS' | 'SUBWAY' | 'METRO_RAIL' | 'TRAIN' | 'TRAM' | 'FERRY' | 'OTHER';
  vehicleName: string;
  lineName: string;
  lineShortName?: string;
  departureStopName: string;
  arrivalStopName: string;
  departureTime?: string;
  arrivalTime?: string;
  departureTimeRaw?: string;
  arrivalTimeRaw?: string;
  stopCount?: number;
  headsign?: string;
}

export interface TransitWalkingPortion {
  distanceMeters: number;
  distanceKm: number;
  durationMinutes: number;
  instruction?: string;
}

export interface TransitFareInfo {
  currencyCode: string;
  units: string;
  nanos?: number;
  formattedFare: string; // e.g. "₹25"
  amount?: number;
}

export interface TransitRouteDetails {
  transitSteps: TransitStepDetail[];
  walkingPortions: TransitWalkingPortion[];
  totalWalkingDistanceKm: number;
  totalWalkingMinutes: number;
  transfersCount: number; // e.g. 0 = direct route, 1 = 1 transfer
  departureTimeFormatted?: string;
  arrivalTimeFormatted?: string;
  departureTimeRaw?: string;
  arrivalTimeRaw?: string;
  apiFare?: TransitFareInfo;
  hasApiFare: boolean;
  hasSubway: boolean;
  hasBus: boolean;
  summaryText: string;
}

export interface RouteResult {
  durationMinutes: number;
  durationSeconds: number;
  distanceKm: number;
  distanceMeters: number;
  travelMode: RouteTravelMode;
  isRealRoute: boolean;
  isFallback: boolean;
  fallbackReason?: string;
  trafficAware: boolean;
  label: string; // e.g. "Estimated travel time"
  provider?: string;
  plannedDepartureTimeRaw?: string;
  plannedDepartureTimeFormatted?: string;
  plannedArrivalTimeRaw?: string;
  plannedArrivalTimeFormatted?: string;
  transitDetails?: TransitStepDetail[];
  transitRouteDetails?: TransitRouteDetails;
  summary?: string;
  routeGeometry?: RouteGeometryPoint[];
  source?: 'google_routes' | 'osrm_live' | 'geodesic_fallback';
  originCoordinates?: { latitude: number; longitude: number };
  destinationCoordinates?: { latitude: number; longitude: number };
}

/**
 * Formats ISO timestamp to human-friendly local time (e.g. "10:15 AM")
 */
export function formatIsoTimeToDisplay(isoString?: string): string | undefined {
  if (!isoString) return undefined;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return undefined;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return undefined;
  }
}

/**
 * Formats a Date or "HH:MM" string to RFC3339 UTC string for Routes API
 */
export function buildRfc3339DepartureTime(dateOrTime?: Date | string): string | undefined {
  if (!dateOrTime) return undefined;
  if (dateOrTime instanceof Date) {
    if (isNaN(dateOrTime.getTime())) return undefined;
    return dateOrTime.toISOString();
  }
  if (typeof dateOrTime === 'string') {
    if (dateOrTime.includes('T')) {
      const d = new Date(dateOrTime);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    if (dateOrTime.includes(':')) {
      const parts = dateOrTime.split(':').map(Number);
      const hours = parts[0] || 0;
      const minutes = parts[1] || 0;
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    }
  }
  return undefined;
}

// In-memory cache for computed routes during session
const routeCache = new Map<string, RouteResult>();

/**
 * Maps application TransportMode to Google Routes API RouteTravelMode
 */
export function mapTransportPreferenceToRouteMode(mode: TransportMode): RouteTravelMode {
  switch (mode) {
    case 'driving':
    case 'auto_cab':
      return 'DRIVE';
    case 'two_wheeler':
      return 'TWO_WHEELER';
    case 'metro':
    case 'bus':
    case 'public_transport':
      return 'TRANSIT';
    case 'walking':
      return 'WALK';
    case 'bicycle':
    case 'bike_rental':
      return 'BICYCLE';
    case 'system_choice':
    default:
      return 'DRIVE';
  }
}

/**
 * Standard Google Encoded Polyline Decoder
 */
export function decodePolyline(encoded: string): RouteGeometryPoint[] {
  if (!encoded) return [];
  const points: RouteGeometryPoint[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  try {
    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < len);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < len);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
  } catch (err) {
    console.warn('[ROUTE] Error decoding polyline:', err);
  }

  return points;
}

/**
 * Helper to build Google Routes API Waypoint payload
 */
function buildWaypointPayload(wp: RouteWaypoint | string): Record<string, unknown> {
  if (typeof wp === 'string') {
    return { address: wp.trim() };
  }

  if (typeof wp.latitude === 'number' && typeof wp.longitude === 'number') {
    return {
      location: {
        latLng: {
          latitude: wp.latitude,
          longitude: wp.longitude,
        },
      },
    };
  }

  if (wp.placeId) {
    return { placeId: wp.placeId };
  }

  if (wp.address) {
    return { address: wp.address.trim() };
  }

  if (wp.name) {
    return { address: wp.name.trim() };
  }

  return { address: '' };
}

/**
 * Helper to generate cache key
 */
function getWaypointCacheKey(wp: RouteWaypoint | string): string {
  if (typeof wp === 'string') return wp.trim().toLowerCase();
  if (typeof wp.latitude === 'number' && typeof wp.longitude === 'number') {
    return `${wp.latitude.toFixed(5)},${wp.longitude.toFixed(5)}`;
  }
  return (wp.address || wp.name || wp.placeId || '').toLowerCase();
}

/**
 * Extracts coordinates from waypoint
 */
function extractCoordinates(wp: RouteWaypoint | string): { lat: number; lng: number } | null {
  if (typeof wp !== 'string' && typeof wp.latitude === 'number' && typeof wp.longitude === 'number') {
    return { lat: wp.latitude, lng: wp.longitude };
  }
  return null;
}

/**
 * Fallback route estimation when live route services are genuinely unavailable or offline.
 * Calculates exact geodesic distance using Haversine with mode-specific circuity factors.
 */
export function calculateFallbackRoute(
  origin: RouteWaypoint | string,
  destination: RouteWaypoint | string,
  travelMode: RouteTravelMode,
  reason = 'Routes API unavailable'
): RouteResult {
  let distanceKm = 4.0;
  const oCoords = extractCoordinates(origin);
  const dCoords = extractCoordinates(destination);

  let geometry: RouteGeometryPoint[] = [];

  if (oCoords && dCoords) {
    const R = 6371; // Earth radius in km
    const dLat = ((dCoords.lat - oCoords.lat) * Math.PI) / 180;
    const dLon = ((dCoords.lng - oCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((oCoords.lat * Math.PI) / 180) *
        Math.cos((dCoords.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLine = R * c;

    // Mode-specific circuity factors:
    // - WALK: Pedestrian footpaths, shortcuts, pedestrian crossings (1.12 - 1.20)
    // - BICYCLE: Bike lanes, side streets (1.15 - 1.25)
    // - TWO_WHEELER: Narrow lanes, motorcycle agile routing (1.18 - 1.28)
    // - DRIVE: One-way roads, divided highways, flyovers, U-turns (1.28 - 1.38)
    // - TRANSIT: Arterial transit corridors and bus route alignment (1.38 - 1.50)
    let modeCircuity = 1.30;
    switch (travelMode) {
      case 'WALK':
        modeCircuity = straightLine < 1.0 ? 1.12 : straightLine < 3.0 ? 1.16 : 1.20;
        break;
      case 'BICYCLE':
        modeCircuity = straightLine < 1.0 ? 1.15 : straightLine < 3.0 ? 1.20 : 1.25;
        break;
      case 'TWO_WHEELER':
        modeCircuity = straightLine < 1.0 ? 1.18 : straightLine < 3.0 ? 1.22 : 1.28;
        break;
      case 'TRANSIT':
        modeCircuity = straightLine < 1.0 ? 1.35 : straightLine < 3.0 ? 1.42 : 1.48;
        break;
      case 'DRIVE':
      default:
        modeCircuity = straightLine < 1.0 ? 1.25 : straightLine < 3.0 ? 1.32 : 1.38;
        break;
    }

    distanceKm = Math.max(0.1, Math.round(straightLine * modeCircuity * 10) / 10);

    // Generate interpolated geometry points between origin and destination
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      geometry.push({
        latitude: oCoords.lat + (dCoords.lat - oCoords.lat) * frac,
        longitude: oCoords.lng + (dCoords.lng - oCoords.lng) * frac,
      });
    }
  }

  // Speed assumptions by mode
  let speedKmH = 24;
  let waitMins = 4;
  switch (travelMode) {
    case 'WALK':
      speedKmH = 4.5;
      waitMins = 0;
      break;
    case 'BICYCLE':
      speedKmH = 13;
      waitMins = 2;
      break;
    case 'TWO_WHEELER':
      speedKmH = 28;
      waitMins = 3;
      break;
    case 'TRANSIT':
      speedKmH = 18;
      waitMins = 8;
      break;
    case 'DRIVE':
    default:
      speedKmH = 25;
      waitMins = 4;
      break;
  }

  const minMins = travelMode === 'WALK' ? 1 : 2;
  const durationMinutes = Math.max(minMins, Math.round((distanceKm / speedKmH) * 60 + waitMins));
  const distanceMeters = Math.round(distanceKm * 1000);

  return {
    durationMinutes,
    durationSeconds: durationMinutes * 60,
    distanceKm,
    distanceMeters,
    travelMode,
    isRealRoute: false,
    isFallback: true,
    fallbackReason: reason,
    trafficAware: false,
    label: 'Estimated travel time (Fallback estimate)',
    routeGeometry: geometry.length > 0 ? geometry : undefined,
    source: 'geodesic_fallback',
    originCoordinates: oCoords ? { latitude: oCoords.lat, longitude: oCoords.lng } : undefined,
    destinationCoordinates: dCoords ? { latitude: dCoords.lat, longitude: dCoords.lng } : undefined,
  };
}

/**
 * Computes a route independently for a specific mode.
 * 1. Validates exact coordinates
 * 2. Primary: Requests live Google Routes API (New)
 * 3. Secondary: Requests live street routing service (OSRM) if Google API key is absent or returns non-200
 * 4. Fallback: Uses geodesic calculation only if network/services genuinely fail
 */
export async function computeRoute(
  origin: RouteWaypoint | string,
  destination: RouteWaypoint | string,
  modeInput: RouteTravelMode | TransportMode = 'DRIVE',
  departureTime?: Date | string
): Promise<RouteResult> {
  const travelMode: RouteTravelMode =
    typeof modeInput === 'string' &&
    ['DRIVE', 'TWO_WHEELER', 'TRANSIT', 'WALK', 'BICYCLE'].includes(modeInput)
      ? (modeInput as RouteTravelMode)
      : mapTransportPreferenceToRouteMode(modeInput as TransportMode);

  const depTimeIso = buildRfc3339DepartureTime(departureTime);
  const cacheKey = `${getWaypointCacheKey(origin)}->${getWaypointCacheKey(destination)}@${travelMode}@${depTimeIso || 'default'}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  const originName = typeof origin === 'string' ? origin : origin.name || origin.address || 'Origin';
  const destName = typeof destination === 'string' ? destination : destination.name || destination.address || 'Destination';
  const oCoords = extractCoordinates(origin);
  const dCoords = extractCoordinates(destination);

  // Section 2: Explicitly log origin & destination coordinates during development
  console.log(
    `[ROUTE DEBUG]\nOrigin:\nname: ${originName}\nlat: ${oCoords?.lat ?? 'N/A'}\nlng: ${oCoords?.lng ?? 'N/A'}\n\nDestination:\nname: ${destName}\nlat: ${dCoords?.lat ?? 'N/A'}\nlng: ${dCoords?.lng ?? 'N/A'}\nMode: ${travelMode}\nDepartureTime: ${depTimeIso || 'N/A'}`
  );

  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    (typeof process !== 'undefined' && (process.env?.VITE_GOOGLE_MAPS_API_KEY || process.env?.GOOGLE_MAPS_API_KEY)) ||
    '';

  const originPayload = buildWaypointPayload(origin);
  const destPayload = buildWaypointPayload(destination);

  // 1. PRIMARY: Try Google Routes API if API key is available
  if (apiKey && (originPayload.address || originPayload.location) && (destPayload.address || destPayload.location)) {
    try {
      const requestBody: Record<string, unknown> = {
        origin: originPayload,
        destination: destPayload,
        travelMode,
      };

      if (depTimeIso) {
        requestBody.departureTime = depTimeIso;
      }

      if (travelMode === 'DRIVE' || travelMode === 'TWO_WHEELER') {
        requestBody.routingPreference = 'TRAFFIC_AWARE';
      }

      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'routes.duration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline,routes.travelAdvisory.transitFare,routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline,routes.legs.departureTime,routes.legs.arrivalTime,routes.legs.travelAdvisory.transitFare,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg0 = route.legs?.[0];
          const durationRaw = route.duration || leg0?.duration || '0s';
          const durationSeconds = parseFloat(durationRaw.replace('s', '')) || 0;
          const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
          const distanceMeters = route.distanceMeters || leg0?.distanceMeters || 0;
          const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;

          // Decode polyline geometry
          const encodedPoly = route.polyline?.encodedPolyline || leg0?.polyline?.encodedPolyline;
          const routeGeometry = encodedPoly ? decodePolyline(encodedPoly) : undefined;

          // Extract planned leg timings
          const legDepTimeRaw = leg0?.departureTime || depTimeIso;
          const legArrTimeRaw = leg0?.arrivalTime;
          const plannedDepartureTimeFormatted = formatIsoTimeToDisplay(legDepTimeRaw);
          const plannedArrivalTimeFormatted = formatIsoTimeToDisplay(legArrTimeRaw);

          // Extract transit details if present
          let transitDetails: TransitStepDetail[] | undefined;
          let transitRouteDetails: TransitRouteDetails | undefined;

          if (travelMode === 'TRANSIT') {
            const steps = leg0?.steps || [];
            const transitSteps: TransitStepDetail[] = [];
            const walkingPortions: TransitWalkingPortion[] = [];
            let totalWalkMeters = 0;
            let totalWalkSeconds = 0;

            for (const step of steps) {
              if (step.transitDetails) {
                const td = step.transitDetails;
                const line = td.transitLine || {};
                const vehicle = line.vehicle || {};
                const stopDetails = td.stopDetails || {};

                let vehicleType: TransitStepDetail['vehicleType'] = 'OTHER';
                const rawType = (vehicle.type || '').toUpperCase();
                if (rawType.includes('BUS')) vehicleType = 'BUS';
                else if (rawType.includes('SUBWAY')) vehicleType = 'SUBWAY';
                else if (rawType.includes('METRO')) vehicleType = 'METRO_RAIL';
                else if (rawType.includes('TRAIN') || rawType.includes('RAIL')) vehicleType = 'TRAIN';
                else if (rawType.includes('TRAM')) vehicleType = 'TRAM';
                else if (rawType.includes('FERRY')) vehicleType = 'FERRY';

                const depTimeRaw = stopDetails.departureTime;
                const arrTimeRaw = stopDetails.arrivalTime;

                transitSteps.push({
                  vehicleType,
                  vehicleName:
                    vehicle.name?.text ||
                    (vehicleType === 'BUS'
                      ? 'City Bus'
                      : vehicleType === 'SUBWAY' || vehicleType === 'METRO_RAIL'
                      ? 'Metro Rail'
                      : vehicleType === 'TRAIN'
                      ? 'Train'
                      : 'Transit'),
                  lineName: line.name || line.nameShort || 'Public Transit',
                  lineShortName: line.nameShort,
                  headsign: td.headsign,
                  departureStopName: stopDetails.departureStop?.name || 'Boarding Stop',
                  arrivalStopName: stopDetails.arrivalStop?.name || 'Deboarding Stop',
                  departureTime: formatIsoTimeToDisplay(depTimeRaw),
                  arrivalTime: formatIsoTimeToDisplay(arrTimeRaw),
                  departureTimeRaw: depTimeRaw,
                  arrivalTimeRaw: arrTimeRaw,
                  stopCount: td.stopCount,
                });
              } else if (step.travelMode === 'WALK' || (!step.transitDetails && (step.distanceMeters || 0) > 0)) {
                const distM = step.distanceMeters || 0;
                const durSec = parseFloat((step.staticDuration || '0s').replace('s', '')) || 0;
                totalWalkMeters += distM;
                totalWalkSeconds += durSec;
                walkingPortions.push({
                  distanceMeters: distM,
                  distanceKm: Math.round((distM / 1000) * 10) / 10,
                  durationMinutes: Math.max(1, Math.round(durSec / 60)),
                  instruction: step.navigationInstruction?.instructions,
                });
              }
            }

            // Real fare from Routes API travelAdvisory
            const rawFare = route.travelAdvisory?.transitFare || leg0?.travelAdvisory?.transitFare;
            let apiFare: TransitFareInfo | undefined;
            if (rawFare && (rawFare.units !== undefined || rawFare.formattedFare)) {
              const curr = rawFare.currencyCode || 'INR';
              const symbol = curr === 'INR' ? '₹' : curr === 'USD' ? '$' : curr === 'EUR' ? '€' : `${curr} `;
              const amount = rawFare.units ? parseInt(rawFare.units, 10) + (rawFare.nanos ? rawFare.nanos / 1e9 : 0) : 0;
              apiFare = {
                currencyCode: curr,
                units: rawFare.units,
                nanos: rawFare.nanos,
                formattedFare: rawFare.formattedFare || `${symbol}${amount.toFixed(0)}`,
                amount,
              };
            }

            const hasSubway = transitSteps.some((s) => s.vehicleType === 'SUBWAY' || s.vehicleType === 'METRO_RAIL');
            const hasBus = transitSteps.some((s) => s.vehicleType === 'BUS');
            const transferCount = Math.max(0, transitSteps.length - 1);

            let summaryText = 'Public Transit';
            if (transitSteps.length > 0) {
              const primaryStep = transitSteps[0];
              summaryText = primaryStep.lineShortName
                ? `${primaryStep.vehicleName} ${primaryStep.lineShortName}`
                : `${primaryStep.vehicleName}: ${primaryStep.lineName}`;
              if (transitSteps.length > 1) {
                summaryText += ` (+${transitSteps.length - 1} transfer${transitSteps.length > 2 ? 's' : ''})`;
              }
            }

            transitDetails = transitSteps;
            transitRouteDetails = {
              transitSteps,
              walkingPortions,
              totalWalkingDistanceKm: Math.round((totalWalkMeters / 1000) * 10) / 10,
              totalWalkingMinutes: Math.round(totalWalkSeconds / 60),
              transfersCount: transferCount,
              departureTimeFormatted: plannedDepartureTimeFormatted,
              arrivalTimeFormatted: plannedArrivalTimeFormatted,
              departureTimeRaw: legDepTimeRaw,
              arrivalTimeRaw: legArrTimeRaw,
              apiFare,
              hasApiFare: Boolean(apiFare),
              hasSubway,
              hasBus,
              summaryText,
            };
          }

          const result: RouteResult = {
            durationMinutes,
            durationSeconds,
            distanceKm,
            distanceMeters,
            travelMode,
            isRealRoute: true,
            isFallback: false,
            source: 'google_routes',
            provider: 'Google Routes API',
            trafficAware: travelMode === 'DRIVE' || travelMode === 'TWO_WHEELER',
            label:
              travelMode === 'TRANSIT'
                ? 'Transit Schedule'
                : travelMode === 'WALK'
                ? 'Walking Route'
                : travelMode === 'TWO_WHEELER'
                ? 'Two-Wheeler Route'
                : 'Driving Route',
            routeGeometry,
            plannedDepartureTimeRaw: legDepTimeRaw,
            plannedDepartureTimeFormatted,
            plannedArrivalTimeRaw: legArrTimeRaw,
            plannedArrivalTimeFormatted,
            transitDetails,
            transitRouteDetails,
            originCoordinates: oCoords ? { latitude: oCoords.lat, longitude: oCoords.lng } : undefined,
            destinationCoordinates: dCoords ? { latitude: dCoords.lat, longitude: dCoords.lng } : undefined,
          };

          routeCache.set(cacheKey, result);
          return result;
        }
      } else {
        console.warn(`[ROUTE] Google Routes API returned status ${response.status} for ${travelMode}:`, await response.text());
      }
    } catch (apiErr) {
      console.warn(`[ROUTE] Error calling Google Routes API for ${travelMode}:`, apiErr);
    }
  }

  // 2. FALLBACK HANDLING
  // If travelMode === 'TRANSIT':
  // Per requirements:
  // - "If transit is unavailable for a segment, simply don't show it as an available option."
  // - "NEVER invent bus numbers, bus names, metro lines, timings, fares."
  // - "Do not assume that a metro or bus exists merely because the city has public transport."
  // If Google Routes API did not return real transit routes, return an unavailable route marked as non-real with no fake transit details.
  if (travelMode === 'TRANSIT') {
    const fallback = calculateFallbackRoute(origin, destination, 'TRANSIT', 'No live public transit schedule found for this segment');
    const result: RouteResult = {
      ...fallback,
      isRealRoute: false,
      isFallback: true,
      label: 'Transit route unavailable',
      fallbackReason: 'No public transit route or schedule available for this origin-destination segment',
      transitDetails: undefined,
      transitRouteDetails: undefined,
    };
    routeCache.set(cacheKey, result);
    return result;
  }

  // For non-transit modes (DRIVE, TWO_WHEELER, WALK):
  // Try OSRM routing if coordinates exist
  if (oCoords && dCoords) {
    try {
      const osrmProfile = travelMode === 'WALK' ? 'foot' : travelMode === 'BICYCLE' ? 'bike' : 'car';
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${oCoords.lng},${oCoords.lat};${dCoords.lng},${dCoords.lat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl);
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        if (osrmData.routes && osrmData.routes.length > 0) {
          const r = osrmData.routes[0];
          const distKm = Math.round((r.distance / 1000) * 10) / 10;
          let durMins = Math.max(1, Math.round(r.duration / 60));
          if (travelMode === 'TWO_WHEELER') {
            durMins = Math.max(1, Math.round(durMins * 0.85)); // 2-wheelers filter traffic slightly faster
          }
          const geom = r.geometry?.coordinates?.map((c: [number, number]) => ({
            latitude: c[1],
            longitude: c[0],
          }));

          const result: RouteResult = {
            durationMinutes: durMins,
            durationSeconds: durMins * 60,
            distanceKm: distKm,
            distanceMeters: Math.round(r.distance),
            travelMode,
            isRealRoute: true,
            isFallback: false,
            source: 'osrm_live',
            provider: 'OSRM OpenStreetMap',
            trafficAware: false,
            label: travelMode === 'WALK' ? 'Walking Route (OSRM)' : `${travelMode} Route (OSRM)`,
            routeGeometry: geom,
            originCoordinates: { latitude: oCoords.lat, longitude: oCoords.lng },
            destinationCoordinates: { latitude: dCoords.lat, longitude: dCoords.lng },
          };
          routeCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (osrmErr) {
      console.warn('[ROUTE] OSRM fallback request failed:', osrmErr);
    }
  }

  // 3. GEODESIC FALLBACK: clearly marked as estimated
  const geodesicFallback = calculateFallbackRoute(origin, destination, travelMode, 'Route data unavailable from routing services; estimated using straight-line distance');
  routeCache.set(cacheKey, geodesicFallback);
  return geodesicFallback;
}

/**
 * Independently evaluates all transportation modes (WALK, TWO_WHEELER, DRIVE, TRANSIT)
 * for a single journey segment and picks the optimal route for system_choice.
 * Outputs the required [ROUTE DEBUG] summary.
 */
export async function evaluateSegmentModesIndependently(
  origin: RouteWaypoint,
  destination: RouteWaypoint,
  departureTime?: Date | string
): Promise<{
  walk: RouteResult | null;
  twoWheeler: RouteResult | null;
  drive: RouteResult | null;
  transit: RouteResult | null;
  selectedRoute: RouteResult;
  selectedMode: TransportMode;
}> {
  // Concurrently request real routes for each mode independently
  const [walkRoute, twoWRoute, driveRoute, transitRoute] = await Promise.all([
    computeRoute(origin, destination, 'WALK').catch((err) => {
      console.warn('[ROUTE] WALK request failed:', err);
      return null;
    }),
    computeRoute(origin, destination, 'TWO_WHEELER', departureTime).catch((err) => {
      console.warn('[ROUTE] TWO_WHEELER request failed:', err);
      return null;
    }),
    computeRoute(origin, destination, 'DRIVE', departureTime).catch((err) => {
      console.warn('[ROUTE] DRIVE request failed:', err);
      return null;
    }),
    computeRoute(origin, destination, 'TRANSIT', departureTime).catch((err) => {
      console.warn('[ROUTE] TRANSIT request failed:', err);
      return null;
    }),
  ]);

  const originName = origin.name || origin.address || `${origin.latitude},${origin.longitude}`;
  const destName = destination.name || destination.address || `${destination.latitude},${destination.longitude}`;
  const originLat = origin.latitude;
  const originLng = origin.longitude;
  const destLat = destination.latitude;
  const destLng = destination.longitude;

  const isWalkAvailable = Boolean(walkRoute && walkRoute.distanceKm > 0);
  const walkDist = walkRoute?.distanceKm || 999;
  const walkDur = walkRoute?.durationMinutes || 999;

  let selectedRoute: RouteResult;
  let selectedMode: TransportMode;
  let reason = '';

  // System Choice Evaluation Logic:
  // - 0–1.0 km: Strongly preferred (Walking — ₹0)
  // - 1.0–2.0 km: Highly practical & recommended (Walking — ₹0)
  // - 2.0–2.5 km: Practical walking option if <= 35 min (Walking — ₹0)
  // - > 2.5 km: Motorized / transit preferred (Two-wheeler / Transit / Cab)
  if (isWalkAvailable && walkDist <= 1.0) {
    selectedRoute = walkRoute!;
    selectedMode = 'walking';
    reason = `Walking strongly preferred for short distance (${walkDist} km, ₹0)`;
  } else if (isWalkAvailable && walkDist <= 2.0 && walkDur <= 30) {
    selectedRoute = walkRoute!;
    selectedMode = 'walking';
    reason = `Walking highly practical & recommended for short distance (${walkDist} km, ~${walkDur} min, ₹0)`;
  } else if (isWalkAvailable && walkDist <= 2.5 && walkDur <= 35) {
    selectedRoute = walkRoute!;
    selectedMode = 'walking';
    reason = `Walking is practical and zero-cost for this distance (${walkDist} km, ~${walkDur} min, ₹0)`;
  } else if (
    transitRoute &&
    transitRoute.transitDetails &&
    transitRoute.transitDetails.length > 0 &&
    transitRoute.durationMinutes <= (driveRoute?.durationMinutes || 999) + 15
  ) {
    selectedRoute = transitRoute;
    selectedMode = 'public_transport';
    reason = `Public transit route available (${transitRoute.distanceKm} km, ~${transitRoute.durationMinutes} min)`;
  } else if (twoWRoute && twoWRoute.distanceKm > 0) {
    selectedRoute = twoWRoute;
    selectedMode = 'two_wheeler';
    reason = `Two-wheeler selected for distance > 2.0 km (${twoWRoute.distanceKm} km, ~${twoWRoute.durationMinutes} min)`;
  } else if (driveRoute && driveRoute.distanceKm > 0) {
    selectedRoute = driveRoute;
    selectedMode = 'auto_cab';
    reason = `Cab/Drive selected (${driveRoute.distanceKm} km, ~${driveRoute.durationMinutes} min)`;
  } else if (walkRoute) {
    selectedRoute = walkRoute;
    selectedMode = 'walking';
    reason = `Walking route fallback (${walkRoute.distanceKm} km)`;
  } else {
    selectedRoute = calculateFallbackRoute(origin, destination, 'DRIVE');
    selectedMode = 'auto_cab';
    reason = 'Fallback driving route engaged';
  }

  const walkStatus = walkRoute?.isRealRoute ? 'success' : walkRoute?.isFallback ? 'fallback' : 'failure';
  const transitStatus =
    transitRoute?.isRealRoute && transitRoute.transitDetails && transitRoute.transitDetails.length > 0
      ? 'success'
      : transitRoute?.isFallback
      ? 'fallback'
      : 'failure';
  const twoWStatus = twoWRoute?.isRealRoute ? 'success' : twoWRoute?.isFallback ? 'fallback' : 'failure';
  const driveStatus = driveRoute?.isRealRoute ? 'success' : driveRoute?.isFallback ? 'fallback' : 'failure';

  const wasFallbackUsed = selectedRoute.isFallback ? 'yes' : 'no';
  const fallbackReason = selectedRoute.isFallback ? selectedRoute.fallbackReason || 'Routes API unavailable' : 'None (Real route used)';

  // Required debug logging (Section 9)
  console.log(
    `[ROUTE DEBUG]\n\nOrigin:\n${originName}\n${originLat ?? 'N/A'}\n${originLng ?? 'N/A'}\n\nDestination:\n${destName}\n${destLat ?? 'N/A'}\n${destLng ?? 'N/A'}\n\nWALK:\n${walkStatus} | ${walkRoute?.distanceKm ?? 'N/A'} km | ${walkRoute?.durationMinutes ?? 'N/A'} min\n\nTRANSIT:\n${transitStatus} | ${transitRoute?.distanceKm ?? 'N/A'} km | ${transitRoute?.durationMinutes ?? 'N/A'} min\n\nTWO_WHEELER:\n${twoWStatus} | ${twoWRoute?.distanceKm ?? 'N/A'} km | ${twoWRoute?.durationMinutes ?? 'N/A'} min\n\nDRIVE:\n${driveStatus} | ${driveRoute?.distanceKm ?? 'N/A'} km | ${driveRoute?.durationMinutes ?? 'N/A'} min\n\nSelected mode: ${selectedMode}\nFallback used: ${wasFallbackUsed}\nFallback reason: ${fallbackReason}\nChoice rationale: ${reason}\n`
  );

  return {
    walk: walkRoute,
    twoWheeler: twoWRoute,
    drive: driveRoute,
    transit: transitRoute,
    selectedRoute,
    selectedMode,
  };
}

/**
 * Computes all sequential legs for a trip plan with real Routes data.
 * Time-aware: cascades planned departure times from segment to segment.
 * Returns a map of legKey -> RouteResult.
 */
export async function computeTripLegs(
  startLocation: string,
  destinations: Destination[],
  returnLocation: string,
  mode: TransportMode = 'auto_cab',
  rentalPickupShop?: { name: string; address?: string; latitude?: number; longitude?: number; distanceKm?: number },
  segmentTransportModes?: Record<string, TransportMode>,
  startCoordinates?: { latitude: number; longitude: number },
  returnCoordinates?: { latitude: number; longitude: number },
  sameReturnLocation: boolean = true,
  startTime?: string
): Promise<Map<string, RouteResult>> {
  const legMap = new Map<string, RouteResult>();
  if (destinations.length === 0) return legMap;

  // Track cascading departure time across segments
  let currentDepartureDate: Date;
  if (startTime) {
    const parts = startTime.split(':').map((p) => parseInt(p, 10));
    const now = new Date();
    now.setHours(parts[0] || 9, parts[1] || 0, 0, 0);
    currentDepartureDate = now;
  } else {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    currentDepartureDate = now;
  }

  // Origin waypoint for Destination 0
  let originWaypointForDest0: RouteWaypoint = {
    name: startLocation || 'Start Location',
    address: startLocation || 'Start Location',
    latitude: startCoordinates?.latitude,
    longitude: startCoordinates?.longitude,
  };

  if (rentalPickupShop) {
    const startWp: RouteWaypoint = {
      name: startLocation || 'Start Location',
      address: startLocation || 'Start Location',
      latitude: startCoordinates?.latitude,
      longitude: startCoordinates?.longitude,
    };
    const rentalWp: RouteWaypoint = {
      name: rentalPickupShop.name,
      address: rentalPickupShop.address || rentalPickupShop.name,
      latitude: rentalPickupShop.latitude,
      longitude: rentalPickupShop.longitude,
    };

    const rentalPickupRoute = await computeRoute(startWp, rentalWp, 'DRIVE', currentDepartureDate);
    legMap.set('leg-start-rental', rentalPickupRoute);
    originWaypointForDest0 = rentalWp;
    currentDepartureDate = new Date(currentDepartureDate.getTime() + (rentalPickupRoute.durationMinutes + 10) * 60000);
  }

  // Leg 0: Start (or Rental Shop) -> Destination 0
  const leg0Key = `leg-start-${destinations[0].id}`;
  const leg0Mode = segmentTransportModes?.['seg-0'] || mode;

  const dest0Waypoint: RouteWaypoint = {
    name: destinations[0].name,
    address: destinations[0].address || destinations[0].name,
    latitude: destinations[0].latitude,
    longitude: destinations[0].longitude,
  };

  let leg0Route: RouteResult;
  if (leg0Mode === 'system_choice') {
    const evaluated = await evaluateSegmentModesIndependently(originWaypointForDest0, dest0Waypoint, currentDepartureDate);
    leg0Route = evaluated.selectedRoute;
  } else {
    const leg0RouteMode = mapTransportPreferenceToRouteMode(leg0Mode);
    leg0Route = await computeRoute(originWaypointForDest0, dest0Waypoint, leg0RouteMode, currentDepartureDate);
  }
  legMap.set(leg0Key, leg0Route);

  // Advance time: leg 0 travel duration + destination 0 visit duration (default 90 mins)
  const dest0Duration = destinations[0].visitDurationMinutes ?? 90;
  currentDepartureDate = new Date(currentDepartureDate.getTime() + (leg0Route.durationMinutes + dest0Duration) * 60000);

  // Subsequent destination legs: Dest[i-1] -> Dest[i]
  for (let i = 1; i < destinations.length; i++) {
    const prev = destinations[i - 1];
    const curr = destinations[i];
    const legKey = `leg-${prev.id}-${curr.id}`;
    const legMode = segmentTransportModes?.[`seg-${i}`] || mode;

    const prevWp: RouteWaypoint = {
      name: prev.name,
      address: prev.address || prev.name,
      latitude: prev.latitude,
      longitude: prev.longitude,
    };
    const currWp: RouteWaypoint = {
      name: curr.name,
      address: curr.address || curr.name,
      latitude: curr.latitude,
      longitude: curr.longitude,
    };

    let legRoute: RouteResult;
    if (legMode === 'system_choice') {
      const evaluated = await evaluateSegmentModesIndependently(prevWp, currWp, currentDepartureDate);
      legRoute = evaluated.selectedRoute;
    } else {
      const legRouteMode = mapTransportPreferenceToRouteMode(legMode);
      legRoute = await computeRoute(prevWp, currWp, legRouteMode, currentDepartureDate);
    }
    legMap.set(legKey, legRoute);

    // Advance time: travel duration + destination visit duration
    const currDuration = curr.visitDurationMinutes ?? 90;
    currentDepartureDate = new Date(currentDepartureDate.getTime() + (legRoute.durationMinutes + currDuration) * 60000);
  }

  // Return leg: Last Dest -> Return Location
  const lastDest = destinations[destinations.length - 1];
  const returnLegKey = `leg-${lastDest.id}-return`;
  const returnMode = segmentTransportModes?.[`seg-${destinations.length}`] || mode;

  const isRoundTrip = sameReturnLocation !== false;
  const finalReturnLocation = isRoundTrip
    ? (startLocation || 'Start Location')
    : (returnLocation || startLocation || 'Return Location');
  const finalReturnCoords = isRoundTrip
    ? startCoordinates
    : (returnCoordinates || startCoordinates);

  const lastWp: RouteWaypoint = {
    name: lastDest.name,
    address: lastDest.address || lastDest.name,
    latitude: lastDest.latitude,
    longitude: lastDest.longitude,
  };
  const returnWp: RouteWaypoint = {
    name: finalReturnLocation,
    address: finalReturnLocation,
    latitude: finalReturnCoords?.latitude,
    longitude: finalReturnCoords?.longitude,
  };

  let returnRoute: RouteResult;
  if (returnMode === 'system_choice') {
    const evaluated = await evaluateSegmentModesIndependently(lastWp, returnWp, currentDepartureDate);
    returnRoute = evaluated.selectedRoute;
  } else {
    const returnRouteMode = mapTransportPreferenceToRouteMode(returnMode);
    returnRoute = await computeRoute(lastWp, returnWp, returnRouteMode, currentDepartureDate);
  }
  legMap.set(returnLegKey, returnRoute);

  return legMap;
}
