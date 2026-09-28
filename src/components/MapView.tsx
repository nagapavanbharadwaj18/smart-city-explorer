import React, { useState } from 'react';
import { MapPin, Navigation, Compass, Layers, Info, Check, Footprints, Bike, Car, Train, ShieldCheck, AlertCircle } from 'lucide-react';
import { Destination, TripConstraints, RouteSegment, TransportMode } from '../types';
import { RouteResult, RouteGeometryPoint } from '../services/routesService';

interface MapViewProps {
  constraints: TripConstraints;
  destinations: Destination[];
  activeDestinationId?: string | null;
  onSelectDestination?: (destId: string) => void;
  routeLegsMap?: Map<string, RouteResult>;
  timeline?: RouteSegment[];
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  activeSegmentId?: string | null;
  onSelectSegment?: (segmentId: string) => void;
}

export type GoogleNativeMapType = 'ROADMAP' | 'SATELLITE' | 'HYBRID';

export const MapView: React.FC<MapViewProps> = ({
  constraints,
  destinations,
  activeDestinationId,
  onSelectDestination,
  routeLegsMap,
  timeline,
  totalDistanceKm: propTotalDistanceKm,
  totalDurationMinutes: propTotalDurationMinutes,
  activeSegmentId,
  onSelectSegment,
}) => {
  const [mapType, setMapType] = useState<GoogleNativeMapType>('ROADMAP');
  const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);

  // Collect all GPS points from start, destinations, return, and all route geometries
  const allGeoPoints: Array<{ lat: number; lon: number }> = [];

  if (constraints.startCoordinates?.latitude !== undefined && constraints.startCoordinates?.longitude !== undefined) {
    allGeoPoints.push({ lat: constraints.startCoordinates.latitude, lon: constraints.startCoordinates.longitude });
  }

  for (const d of destinations) {
    if (d.latitude !== undefined && d.longitude !== undefined) {
      allGeoPoints.push({ lat: d.latitude, lon: d.longitude });
    }
  }

  if (
    !constraints.sameReturnLocation &&
    constraints.returnCoordinates?.latitude !== undefined &&
    constraints.returnCoordinates?.longitude !== undefined
  ) {
    allGeoPoints.push({ lat: constraints.returnCoordinates.latitude, lon: constraints.returnCoordinates.longitude });
  }

  if (constraints.rentalPickupShop?.latitude !== undefined && constraints.rentalPickupShop?.longitude !== undefined) {
    allGeoPoints.push({ lat: constraints.rentalPickupShop.latitude, lon: constraints.rentalPickupShop.longitude });
  }

  // Also include route geometry points if available for tight bounding box
  if (routeLegsMap) {
    routeLegsMap.forEach((leg) => {
      if (leg.routeGeometry) {
        for (const pt of leg.routeGeometry) {
          allGeoPoints.push({ lat: pt.latitude, lon: pt.longitude });
        }
      }
    });
  }

  const hasRealGeo = allGeoPoints.length >= 2;
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;

  if (hasRealGeo) {
    for (const p of allGeoPoints) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }
    const latSpan = Math.max(maxLat - minLat, 0.012);
    const lonSpan = Math.max(maxLon - minLon, 0.012);
    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;
    minLat = midLat - latSpan * 0.65;
    maxLat = midLat + latSpan * 0.65;
    minLon = midLon - lonSpan * 0.65;
    maxLon = midLon + lonSpan * 0.65;
  }

  const projectToSvg = (lat?: number, lon?: number, fallbackX = 50, fallbackY = 50) => {
    if (hasRealGeo && lat !== undefined && lon !== undefined && maxLon > minLon && maxLat > minLat) {
      const x = ((lon - minLon) / (maxLon - minLon)) * 340 + 30;
      const y = ((maxLat - lat) / (maxLat - minLat)) * 240 + 40;
      return { x: Math.max(25, Math.min(375, x)), y: Math.max(25, Math.min(295, y)) };
    }
    return { x: fallbackX * 3.4 + 30, y: fallbackY * 2.4 + 40 };
  };

  const startPt = projectToSvg(
    constraints.startCoordinates?.latitude,
    constraints.startCoordinates?.longitude,
    35,
    45
  );

  const returnPt = constraints.sameReturnLocation
    ? startPt
    : projectToSvg(
        constraints.returnCoordinates?.latitude,
        constraints.returnCoordinates?.longitude,
        65,
        75
      );

  const rentalPt = constraints.rentalPickupShop && constraints.rentalPickupShop.latitude !== undefined && constraints.rentalPickupShop.longitude !== undefined
    ? projectToSvg(
        constraints.rentalPickupShop.latitude,
        constraints.rentalPickupShop.longitude,
        38,
        48
      )
    : null;

  const destPoints = destinations.map((d, i) => ({
    dest: d,
    pt: projectToSvg(d.latitude, d.longitude, d.coordinates?.x ?? 50, d.coordinates?.y ?? 50),
    index: i,
  }));

  // Build leg polylines using exact route geometry from RouteResult whenever available
  interface LegRenderData {
    legKey: string;
    index: number;
    fromName: string;
    toName: string;
    mode: string;
    distanceKm: number;
    durationMinutes: number;
    isRealRoute: boolean;
    isFallback: boolean;
    fallbackReason?: string;
    svgPath: string;
  }

  const legsData: LegRenderData[] = [];

  if (destinations.length > 0) {
    // Helper to find corresponding travel segment from timeline
    const findTimelineTravel = (segmentId: string) => {
      return timeline?.find((t) => t.type === 'travel' && t.id === segmentId);
    };

    // If rental pickup shop selected: Leg from Start -> Rental Shop
    if (constraints.rentalPickupShop && rentalPt) {
      const rentalShop = constraints.rentalPickupShop;
      const rentalResult = routeLegsMap?.get('leg-start-rental');
      const rentalTimeline = findTimelineTravel('travel-rental-pickup');
      const fromRental = startPt;
      const toRental = rentalPt;

      const hasRentalGeo = Boolean(rentalResult?.routeGeometry && rentalResult.routeGeometry.length > 1);
      let pathRental = '';
      if (hasRentalGeo && rentalResult!.routeGeometry) {
        const pts = rentalResult!.routeGeometry.map((p) => projectToSvg(p.latitude, p.longitude));
        pathRental = [
          `M ${fromRental.x.toFixed(1)} ${fromRental.y.toFixed(1)}`,
          ...pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
          `L ${toRental.x.toFixed(1)} ${toRental.y.toFixed(1)}`,
        ].join(' ');
      } else {
        pathRental = `M ${fromRental.x.toFixed(1)} ${fromRental.y.toFixed(1)} L ${toRental.x.toFixed(1)} ${toRental.y.toFixed(1)}`;
      }

      const isRentalReal = Boolean(rentalTimeline?.isRealRoute ?? (rentalResult ? rentalResult.isRealRoute && hasRentalGeo : false));

      legsData.push({
        legKey: 'leg-start-rental',
        index: -1,
        fromName: constraints.startLocation || 'Starting Location',
        toName: rentalShop.name,
        mode: rentalTimeline?.transportMode || 'auto_cab',
        distanceKm: rentalTimeline?.distanceKm ?? rentalResult?.distanceKm ?? rentalShop.distanceKm ?? 1.5,
        durationMinutes: rentalTimeline?.durationMinutes ?? rentalResult?.durationMinutes ?? 10,
        isRealRoute: isRentalReal,
        isFallback: !isRentalReal,
        fallbackReason: rentalResult?.fallbackReason || (!isRentalReal ? 'Live road geometry unavailable' : undefined),
        svgPath: pathRental,
      });
    }

    // Leg 0: Start (or Rental Shop) -> Dest 0
    const leg0Key = `leg-start-${destinations[0].id}`;
    const leg0Result = routeLegsMap?.get(leg0Key);
    const leg0Timeline = findTimelineTravel(`travel-${destinations[0].id}`);
    const from0 = rentalPt || startPt;
    const from0Name = constraints.rentalPickupShop?.name || constraints.startLocation || 'Starting Location';
    const to0 = destPoints[0]?.pt || startPt;

    const hasRouteGeo0 = Boolean(leg0Result?.routeGeometry && leg0Result.routeGeometry.length > 1);
    let pathD0 = '';
    if (hasRouteGeo0 && leg0Result!.routeGeometry) {
      const pts = leg0Result!.routeGeometry.map((p) => projectToSvg(p.latitude, p.longitude));
      pathD0 = [
        `M ${from0.x.toFixed(1)} ${from0.y.toFixed(1)}`,
        ...pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
        `L ${to0.x.toFixed(1)} ${to0.y.toFixed(1)}`,
      ].join(' ');
    } else {
      pathD0 = `M ${from0.x.toFixed(1)} ${from0.y.toFixed(1)} L ${to0.x.toFixed(1)} ${to0.y.toFixed(1)}`;
    }

    const isLeg0Real = Boolean(leg0Timeline?.isRealRoute ?? (leg0Result ? leg0Result.isRealRoute && hasRouteGeo0 : false));

    legsData.push({
      legKey: leg0Key,
      index: 0,
      fromName: from0Name,
      toName: destinations[0].name,
      mode: leg0Timeline?.transportMode || leg0Result?.travelMode || constraints.transportPreference,
      distanceKm: leg0Timeline?.distanceKm ?? leg0Result?.distanceKm ?? destinations[0].distanceKm ?? 1.5,
      durationMinutes: leg0Timeline?.durationMinutes ?? leg0Result?.durationMinutes ?? 10,
      isRealRoute: isLeg0Real,
      isFallback: !isLeg0Real,
      fallbackReason: leg0Result?.fallbackReason || (!isLeg0Real ? 'Live road geometry unavailable' : undefined),
      svgPath: pathD0,
    });

    // Destination legs: Dest[i-1] -> Dest[i]
    for (let i = 1; i < destinations.length; i++) {
      const prev = destinations[i - 1];
      const curr = destinations[i];
      const legKey = `leg-${prev.id}-${curr.id}`;
      const legResult = routeLegsMap?.get(legKey);
      const legTimeline = findTimelineTravel(`travel-${curr.id}`);
      const fromPt = destPoints[i - 1].pt;
      const toPt = destPoints[i].pt;

      const hasLegGeo = Boolean(legResult?.routeGeometry && legResult.routeGeometry.length > 1);
      let pathD = '';
      if (hasLegGeo && legResult!.routeGeometry) {
        const pts = legResult!.routeGeometry.map((p) => projectToSvg(p.latitude, p.longitude));
        pathD = [
          `M ${fromPt.x.toFixed(1)} ${fromPt.y.toFixed(1)}`,
          ...pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
          `L ${toPt.x.toFixed(1)} ${toPt.y.toFixed(1)}`,
        ].join(' ');
      } else {
        pathD = `M ${fromPt.x.toFixed(1)} ${fromPt.y.toFixed(1)} L ${toPt.x.toFixed(1)} ${toPt.y.toFixed(1)}`;
      }

      const isLegReal = Boolean(legTimeline?.isRealRoute ?? (legResult ? legResult.isRealRoute && hasLegGeo : false));

      legsData.push({
        legKey,
        index: i,
        fromName: prev.name,
        toName: curr.name,
        mode: legTimeline?.transportMode || legResult?.travelMode || constraints.transportPreference,
        distanceKm: legTimeline?.distanceKm ?? legResult?.distanceKm ?? 2.0,
        durationMinutes: legTimeline?.durationMinutes ?? legResult?.durationMinutes ?? 12,
        isRealRoute: isLegReal,
        isFallback: !isLegReal,
        fallbackReason: legResult?.fallbackReason || (!isLegReal ? 'Live road geometry unavailable' : undefined),
        svgPath: pathD,
      });
    }

    // Return leg: Last Dest -> Return Location
    const lastDest = destinations[destinations.length - 1];
    const returnLegKey = `leg-${lastDest.id}-return`;
    const returnResult = routeLegsMap?.get(returnLegKey);
    const returnTimeline = findTimelineTravel('travel-return');
    const lastPt = destPoints[destPoints.length - 1].pt;

    const hasReturnGeo = Boolean(returnResult?.routeGeometry && returnResult.routeGeometry.length > 1);
    let pathDReturn = '';
    if (hasReturnGeo && returnResult!.routeGeometry) {
      const pts = returnResult!.routeGeometry.map((p) => projectToSvg(p.latitude, p.longitude));
      pathDReturn = [
        `M ${lastPt.x.toFixed(1)} ${lastPt.y.toFixed(1)}`,
        ...pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
        `L ${returnPt.x.toFixed(1)} ${returnPt.y.toFixed(1)}`,
      ].join(' ');
    } else {
      pathDReturn = `M ${lastPt.x.toFixed(1)} ${lastPt.y.toFixed(1)} L ${returnPt.x.toFixed(1)} ${returnPt.y.toFixed(1)}`;
    }

    const isRoundTrip = constraints.sameReturnLocation !== false;
    const finalReturnName = isRoundTrip
      ? (constraints.startLocation || 'Starting Location')
      : (constraints.returnLocation || constraints.startLocation || 'Return Destination');

    const isReturnReal = Boolean(returnTimeline?.isRealRoute ?? (returnResult ? returnResult.isRealRoute && hasReturnGeo : false));

    legsData.push({
      legKey: returnLegKey,
      index: destinations.length,
      fromName: lastDest.name,
      toName: finalReturnName,
      mode: returnTimeline?.transportMode || returnResult?.travelMode || constraints.transportPreference,
      distanceKm: returnTimeline?.distanceKm ?? returnResult?.distanceKm ?? 2.5,
      durationMinutes: returnTimeline?.durationMinutes ?? returnResult?.durationMinutes ?? 15,
      isRealRoute: isReturnReal,
      isFallback: !isReturnReal,
      fallbackReason: returnResult?.fallbackReason || (!isReturnReal ? 'Live road geometry unavailable' : undefined),
      svgPath: pathDReturn,
    });
  }

  // Total route statistics: prefer shared exact result, fallback to sum
  const totalRouteDistanceKm =
    typeof propTotalDistanceKm === 'number'
      ? Math.round(propTotalDistanceKm * 10) / 10
      : Math.round(legsData.reduce((sum, leg) => sum + leg.distanceKm, 0) * 10) / 10;

  const totalRouteDurationMins =
    typeof propTotalDurationMinutes === 'number'
      ? propTotalDurationMinutes
      : legsData.reduce((sum, leg) => sum + leg.durationMinutes, 0);

  const anyFallback = legsData.some((l) => l.isFallback);

  // Active highlighted leg or destination (handle index -1 for rental pickup leg cleanly)
  const activeLeg = selectedLegIndex !== null ? legsData.find((l) => l.index === selectedLegIndex) || null : null;

  const getModeIcon = (mode: string) => {
    const m = mode.toLowerCase();
    if (m.includes('walk')) return <Footprints className="w-3.5 h-3.5 text-emerald-400" />;
    if (m.includes('bike') || m.includes('bicycle')) return <Bike className="w-3.5 h-3.5 text-sky-400" />;
    if (m.includes('two') || m.includes('motor')) return <Navigation className="w-3.5 h-3.5 text-amber-400" />;
    if (m.includes('transit') || m.includes('bus') || m.includes('metro')) return <Train className="w-3.5 h-3.5 text-purple-400" />;
    return <Car className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 text-white shadow-xl flex flex-col justify-between overflow-hidden relative min-h-[480px]">
      
      {/* Top Map Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Real Route Geometry & Waypoints
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {anyFallback ? (
            <span className="px-2 py-0.5 rounded-lg bg-amber-950/70 border border-amber-700/60 text-amber-300 font-medium flex items-center gap-1 text-[10px]">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              Fallback estimate
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 font-medium flex items-center gap-1 text-[10px]">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Live Route Verified
            </span>
          )}

          {/* Map / Satellite / Hybrid view toggle */}
          <div
            role="group"
            aria-label="Map Type"
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px]"
          >
            <button
              type="button"
              onClick={() => setMapType('ROADMAP')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mapType === 'ROADMAP'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
              }`}
              title="Standard Street Map (ROADMAP)"
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMapType('SATELLITE')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mapType === 'SATELLITE'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
              }`}
              title="Satellite Imagery (SATELLITE)"
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapType('HYBRID')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mapType === 'HYBRID'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
              }`}
              title="Hybrid Satellite & Road Map (HYBRID)"
            >
              Hybrid
            </button>
          </div>
        </div>
      </div>

      {/* SVG Vector Map Canvas */}
      <div className={`relative flex-1 my-3 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800/80 min-h-[290px] transition-colors duration-300 ${
        mapType === 'SATELLITE' ? 'bg-[#0a1811]' : mapType === 'HYBRID' ? 'bg-[#0d1d16]' : 'bg-slate-950'
      }`}>
        
        {/* Subtle radial radar / satellite scan grid background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className={`w-72 h-72 rounded-full border ${mapType === 'ROADMAP' ? 'border-teal-500/40' : 'border-emerald-400/40'}`} />
          <div className={`w-48 h-48 rounded-full border ${mapType === 'ROADMAP' ? 'border-teal-500/30' : 'border-emerald-400/30'}`} />
          <div className={`w-24 h-24 rounded-full border ${mapType === 'ROADMAP' ? 'border-teal-500/20' : 'border-emerald-400/20'}`} />
        </div>

        <svg
          viewBox="0 0 400 320"
          className="w-full h-full object-cover select-none"
        >
          <defs>
            {/* Satellite Terrain Gradient & Landmass textures */}
            <linearGradient id="satTerrainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#091b14" />
              <stop offset="35%" stopColor="#122a1b" />
              <stop offset="70%" stopColor="#1a3524" />
              <stop offset="100%" stopColor="#0b1a12" />
            </linearGradient>
            <radialGradient id="satLandform1" cx="30%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#2a4d33" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#143321" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#091b14" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="satLandform2" cx="75%" cy="65%" r="50%">
              <stop offset="0%" stopColor="#35563e" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#1a3826" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#091b14" stopOpacity="0" />
            </radialGradient>
            <pattern id="satelliteTexture" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="1" fill="#325a3c" opacity="0.35" />
              <circle cx="15" cy="16" r="0.8" fill="#467252" opacity="0.25" />
              <circle cx="19" cy="7" r="1.1" fill="#24452c" opacity="0.4" />
            </pattern>
          </defs>

          {/* Satellite / Hybrid Imagery Base Layer */}
          {(mapType === 'SATELLITE' || mapType === 'HYBRID') && (
            <g className="satellite-layer">
              <rect width="400" height="320" fill="url(#satTerrainGradient)" />
              <rect width="400" height="320" fill="url(#satLandform1)" />
              <rect width="400" height="320" fill="url(#satLandform2)" />
              <rect width="400" height="320" fill="url(#satelliteTexture)" />
              {/* Subtle topographical contour paths */}
              <g stroke="#3f6f4d" strokeWidth="0.75" opacity="0.25" fill="none">
                <path d="M 10 90 Q 90 70, 160 110 T 310 100 T 390 140" />
                <path d="M 20 160 Q 110 140, 190 180 T 320 170 T 390 200" />
                <path d="M 10 240 Q 120 210, 220 250 T 360 230" />
              </g>
            </g>
          )}

          {/* Road / Cartographic Coordinate Grid for ROADMAP and HYBRID modes */}
          {(mapType === 'ROADMAP' || mapType === 'HYBRID') && (
            <g stroke={mapType === 'HYBRID' ? '#475569' : '#334155'} strokeWidth="0.8" opacity={mapType === 'HYBRID' ? 0.35 : 0.25}>
              <line x1="50" y1="20" x2="50" y2="300" strokeDasharray="3 3" />
              <line x1="125" y1="20" x2="125" y2="300" strokeDasharray="3 3" />
              <line x1="200" y1="20" x2="200" y2="300" strokeDasharray="3 3" />
              <line x1="275" y1="20" x2="275" y2="300" strokeDasharray="3 3" />
              <line x1="350" y1="20" x2="350" y2="300" strokeDasharray="3 3" />
              <line x1="20" y1="60" x2="380" y2="60" strokeDasharray="3 3" />
              <line x1="20" y1="120" x2="380" y2="120" strokeDasharray="3 3" />
              <line x1="20" y1="180" x2="380" y2="180" strokeDasharray="3 3" />
              <line x1="20" y1="240" x2="380" y2="240" strokeDasharray="3 3" />
            </g>
          )}

          {/* Hybrid Mode Road Networks & Corridors */}
          {mapType === 'HYBRID' && (
            <g stroke="#64748b" strokeWidth="1" opacity="0.25" fill="none" strokeDasharray="8 6">
              <path d="M 40 50 L 180 80 L 320 60 L 370 120" />
              <path d="M 30 150 L 150 160 L 260 210 L 360 250" />
              <path d="M 120 30 L 130 150 L 110 280" />
              <path d="M 280 40 L 270 170 L 290 290" />
            </g>
          )}

          {/* Render All Legs in Exact Itinerary Order */}
          {legsData.map((leg) => {
            const isSelected = selectedLegIndex === leg.index;
            return (
              <g
                key={leg.legKey}
                className="cursor-pointer transition-opacity"
                onClick={() => setSelectedLegIndex(isSelected ? null : leg.index)}
              >
                {/* Background glow stroke */}
                <path
                  d={leg.svgPath}
                  fill="none"
                  stroke={isSelected ? '#38bdf8' : leg.isFallback ? '#d97706' : '#10b981'}
                  strokeWidth={isSelected ? '10' : leg.isFallback ? '5' : '6'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isSelected ? 0.45 : leg.isFallback ? 0.2 : 0.25}
                />
                {/* Foreground polyline track */}
                <path
                  d={leg.svgPath}
                  fill="none"
                  stroke={isSelected ? '#38bdf8' : leg.isFallback ? '#f59e0b' : '#34d399'}
                  strokeWidth={isSelected ? '3.5' : leg.isFallback ? '2.2' : '2.8'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={leg.isFallback ? '4 4' : (isSelected ? 'none' : '6 3')}
                  className={isSelected ? '' : leg.isFallback ? '' : 'animate-pulse'}
                />
              </g>
            );
          })}

          {/* START Point Pin */}
          <g
            transform={`translate(${startPt.x}, ${startPt.y})`}
            className="cursor-pointer"
            onClick={() => setSelectedLegIndex(0)}
          >
            <circle r="10" fill="#0f172a" stroke="#10b981" strokeWidth="2.5" />
            <circle r="4" fill="#34d399" />
            <text x="14" y="4" fill="#ffffff" fontSize="9" fontWeight="bold">
              {constraints.sameReturnLocation ? 'Start & Return' : 'Start'}
            </text>
          </g>

          {/* Rental Shop Pickup Pin */}
          {constraints.rentalPickupShop && rentalPt && (
            <g
              transform={`translate(${rentalPt.x}, ${rentalPt.y})`}
              className="cursor-pointer"
              onClick={() => setSelectedLegIndex(-1)}
            >
              <circle r="10" fill="#0f172a" stroke="#f59e0b" strokeWidth="2.5" />
              <circle r="4" fill="#fbbf24" />
              <text x="14" y="4" fill="#fef08a" fontSize="8.5" fontWeight="bold">
                🚲 {constraints.rentalPickupShop.name.length > 15 ? `${constraints.rentalPickupShop.name.slice(0, 13)}…` : constraints.rentalPickupShop.name}
              </text>
            </g>
          )}

          {/* Destinations Pins */}
          {destPoints.map(({ dest, pt, index }) => {
            const isActive = activeDestinationId === dest.id || selectedLegIndex === index || selectedLegIndex === index + 1;

            return (
              <g
                key={dest.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="cursor-pointer transition-transform"
                onClick={() => {
                  if (onSelectDestination) onSelectDestination(dest.id);
                  setSelectedLegIndex(index);
                }}
              >
                {isActive && (
                  <circle r="17" fill="#10b981" opacity="0.35" className="animate-ping" />
                )}
                <circle
                  r={isActive ? '12' : '9.5'}
                  fill={isActive ? '#10b981' : '#059669'}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {index + 1}
                </text>
                <text
                  x="15"
                  y="4"
                  fill={isActive ? '#34d399' : '#cbd5e1'}
                  fontSize="9"
                  fontWeight={isActive ? 'bold' : 'normal'}
                >
                  {dest.name.length > 16 ? `${dest.name.slice(0, 14)}…` : dest.name}
                </text>
              </g>
            );
          })}

          {/* RETURN Point Pin (if different from start) */}
          {!constraints.sameReturnLocation && (
            <g
              transform={`translate(${returnPt.x}, ${returnPt.y})`}
              className="cursor-pointer"
              onClick={() => setSelectedLegIndex(destinations.length)}
            >
              <circle r="10" fill="#0f172a" stroke="#0284c7" strokeWidth="2.5" />
              <circle r="4" fill="#38bdf8" />
              <text x="14" y="4" fill="#38bdf8" fontSize="9" fontWeight="bold">
                Return
              </text>
            </g>
          )}
        </svg>

        {/* Selected Leg Floating Detail Card */}
        {activeLeg && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-teal-500/40 text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-white flex items-center gap-1.5 truncate">
                {getModeIcon(activeLeg.mode)}
                <span className="truncate">
                  {activeLeg.fromName.split(',')[0]} → {activeLeg.toName.split(',')[0]}
                </span>
              </span>
              <button
                onClick={() => setSelectedLegIndex(null)}
                className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-300">
              <span className="font-bold text-emerald-400">{activeLeg.distanceKm.toFixed(1)} km</span>
              <span>•</span>
              <span className="font-semibold text-slate-200">~{activeLeg.durationMinutes} min</span>
              <span>•</span>
              <span className="capitalize text-slate-400">{activeLeg.mode.replace('_', ' ')}</span>
              <span>•</span>
              {activeLeg.isFallback ? (
                <span className="text-amber-300 font-medium flex items-center gap-1 text-[10px]">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Connecting line (Approximation — actual road geometry unavailable)</span>
                </span>
              ) : (
                <span className="text-emerald-400 font-medium flex items-center gap-1 text-[10px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Live road geometry</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map Footer Summary Bar */}
      <div className="pt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2 border-t border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Total Route:
            <strong className="text-slate-100 font-bold ml-0.5">{totalRouteDistanceKm} km</strong>
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-slate-100 font-bold">~{totalRouteDurationMins} min</strong> travel
          </span>
        </div>
        <div className="flex items-center gap-2 font-medium text-slate-300">
          <span>Mode:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-semibold uppercase text-[10px]">
            {Object.keys(constraints.segmentTransportModes || {}).length > 1
              ? 'Multi-Mode Route'
              : (constraints.transportPreference || 'Auto').replace('_', ' ')}
          </span>
        </div>
      </div>

    </div>
  );
};
