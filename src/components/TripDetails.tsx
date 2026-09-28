import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Wallet,
  Users,
  ArrowRight,
  Crosshair,
  Info,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { TripConstraints, PlanningMode } from '../types';
import { POPULAR_START_LOCATIONS } from '../data/mockData';
import { LocationAutocomplete } from './LocationAutocomplete';
import {
  LocationSuggestion,
  MULTI_CITY_LOCATIONS_DATABASE,
  geocodeLocationName,
  detectCityFromLocation,
} from '../data/locationSuggestions';
import { obtainDeviceLocation } from '../services/geolocationService';

interface TripDetailsProps {
  constraints: TripConstraints;
  mode: PlanningMode;
  onChangeConstraints: (constraints: TripConstraints) => void;
  onSubmit: (updatedConstraints?: TripConstraints) => void;
  onBack: () => void;
}

export const TripDetails: React.FC<TripDetailsProps> = ({
  constraints,
  mode,
  onChangeConstraints,
  onSubmit,
  onBack,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Handle explicit Current Location request using native Geolocation API
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setLocationStatus({
      type: 'info',
      message: 'Acquiring device geolocation coordinates...',
    });

    try {
      const geoResult = await obtainDeviceLocation();

      const locationInfo = {
        name: geoResult.locationName,
        address: geoResult.locationName,
        city: detectCityFromLocation(geoResult.locationName),
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        placeId: `device-geo-${geoResult.latitude}-${geoResult.longitude}`,
      };

      // Store authoritative coordinates and reverse-geocoded address
      const updatedConstraints: TripConstraints = {
        ...constraints,
        startLocation: geoResult.locationName,
        startCoordinates: {
          latitude: geoResult.latitude,
          longitude: geoResult.longitude,
        },
        startLocationInfo: locationInfo,
        returnLocation: constraints.sameReturnLocation
          ? geoResult.locationName
          : constraints.returnLocation,
        returnCoordinates: constraints.sameReturnLocation
          ? {
              latitude: geoResult.latitude,
              longitude: geoResult.longitude,
            }
          : constraints.returnCoordinates,
        isCurrentLocation: true,
        locationAccuracy: geoResult.accuracy,
        locationWarning: geoResult.accuracyWarning,
      };

      onChangeConstraints(updatedConstraints);

      if (geoResult.isLowAccuracy) {
        setLocationStatus({
          type: 'warning',
          message: 'Location accuracy is low. Please confirm your starting location.',
        });
      } else {
        setLocationStatus({
          type: 'success',
          message: `Current location locked: ${geoResult.locationName}`,
        });
        setTimeout(() => {
          setLocationStatus((prev) => (prev?.type === 'success' ? null : prev));
        }, 5000);
      }
    } catch (err: any) {
      // Handle permission denial or geolocation failure without fallback to default cities
      const errorMessage =
        err?.message ||
        'Unable to retrieve your location. Please enter your starting location manually.';

      setLocationStatus({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsLocating(false);
    }
  };

  // Handle manual typing of starting location
  const handleManualLocationChange = (val: string) => {
    setLocationStatus(null);
    const trimmed = val.trim();
    const exactMatch = MULTI_CITY_LOCATIONS_DATABASE.find(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase()
    );

    const coords =
      exactMatch?.lat !== undefined && exactMatch?.lon !== undefined
        ? { latitude: exactMatch.lat, longitude: exactMatch.lon }
        : undefined;

    const locationInfo = coords
      ? {
          name: exactMatch?.name || val,
          address: exactMatch?.secondaryText || exactMatch?.name || val,
          city: exactMatch?.city || detectCityFromLocation(val),
          latitude: coords.latitude,
          longitude: coords.longitude,
          placeId: exactMatch?.id || `loc-${coords.latitude}-${coords.longitude}`,
        }
      : undefined;

    // Notice: if exactMatch is not found, startCoordinates and startLocationInfo are cleared
    // so stale coordinates from a prior city are never reused!
    onChangeConstraints({
      ...constraints,
      startLocation: val,
      startCoordinates: coords,
      startLocationInfo: locationInfo,
      isCurrentLocation: false,
      locationAccuracy: undefined,
      locationWarning: undefined,
      returnLocation: constraints.sameReturnLocation ? val : constraints.returnLocation,
      returnCoordinates: constraints.sameReturnLocation ? coords : constraints.returnCoordinates,
    });
  };

  // Handle selection from autocomplete suggestions
  const handleSelectSuggestion = async (item: LocationSuggestion) => {
    setLocationStatus(null);
    let coords: { latitude: number; longitude: number } | undefined =
      item.lat !== undefined && item.lon !== undefined
        ? { latitude: item.lat, longitude: item.lon }
        : undefined;

    let address: string | undefined = item.secondaryText;
    let detectedCity: string | undefined = item.city;
    let placeId: string | undefined = item.id;

    if (!coords && item.name) {
      const geo = await geocodeLocationName(item.name);
      if (geo) {
        coords = { latitude: geo.latitude, longitude: geo.longitude };
        address = address || geo.formattedAddress;
        detectedCity = detectedCity || geo.city;
        placeId = placeId || geo.placeId;
      }
    }

    if (!coords) {
      setLocationStatus({
        type: 'error',
        message: `Could not resolve coordinates for ${item.name}.`,
      });
      return;
    }

    const locationInfo = {
      name: item.name,
      address: address || item.name,
      city: detectedCity || item.city || detectCityFromLocation(item.name),
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeId: placeId || `loc-${coords.latitude}-${coords.longitude}`,
    };

    onChangeConstraints({
      ...constraints,
      startLocation: item.name,
      startCoordinates: coords,
      startLocationInfo: locationInfo,
      isCurrentLocation: false,
      locationAccuracy: undefined,
      locationWarning: undefined,
      returnLocation: constraints.sameReturnLocation ? item.name : constraints.returnLocation,
      returnCoordinates: constraints.sameReturnLocation ? coords : constraints.returnCoordinates,
    });
  };

  // Handle selection from popular location presets
  const handleSelectPreset = async (loc: string) => {
    setLocationStatus(null);
    const locLower = loc.trim().toLowerCase();
    const matched = MULTI_CITY_LOCATIONS_DATABASE.find(
      (m) =>
        m.name.toLowerCase() === locLower ||
        m.id.toLowerCase() === locLower ||
        (locLower.length >= 5 && m.name.toLowerCase().startsWith(locLower))
    );

    let coords: { latitude: number; longitude: number } | undefined =
      matched?.lat !== undefined && matched?.lon !== undefined
        ? { latitude: matched.lat, longitude: matched.lon }
        : undefined;

    let address: string | undefined = matched?.secondaryText;
    let detectedCity: string | undefined = matched?.city;
    let placeId: string | undefined = matched?.id;

    if (!coords) {
      const geo = await geocodeLocationName(loc);
      if (geo) {
        coords = { latitude: geo.latitude, longitude: geo.longitude };
        address = geo.formattedAddress || loc;
        detectedCity = geo.city || detectCityFromLocation(loc);
        placeId = geo.placeId;
      }
    }

    if (!coords) {
      setLocationStatus({
        type: 'error',
        message: `Could not resolve coordinates for ${loc}. Please try another location.`,
      });
      return;
    }

    const locationInfo = {
      name: matched?.name || loc,
      address: address || matched?.secondaryText || loc,
      city: detectedCity || matched?.city || detectCityFromLocation(loc),
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeId: placeId || `preset-${coords.latitude}-${coords.longitude}`,
    };

    onChangeConstraints({
      ...constraints,
      startLocation: matched?.name || loc,
      startCoordinates: coords,
      startLocationInfo: locationInfo,
      isCurrentLocation: false,
      locationAccuracy: undefined,
      locationWarning: undefined,
      returnLocation: constraints.sameReturnLocation ? (matched?.name || loc) : constraints.returnLocation,
      returnCoordinates: constraints.sameReturnLocation ? coords : constraints.returnCoordinates,
    });
  };

  const handleContinue = async () => {
    if (!constraints.startLocation || !constraints.startLocation.trim()) {
      setLocationStatus({
        type: 'error',
        message: 'Please enter or select a starting location.',
      });
      return;
    }

    let latestConstraints = { ...constraints };
    let coords = constraints.startCoordinates;
    let locationInfo = constraints.startLocationInfo;

    // Strictly ensure exact coordinates and location info exist for startLocation
    if (!coords?.latitude || !coords?.longitude || !locationInfo?.placeId) {
      setIsLocating(true);
      setLocationStatus({
        type: 'info',
        message: 'Resolving precise map coordinates for starting location...',
      });
      try {
        const geo = await geocodeLocationName(constraints.startLocation);
        if (geo) {
          coords = { latitude: geo.latitude, longitude: geo.longitude };
          locationInfo = {
            name: geo.name || constraints.startLocation,
            address: geo.formattedAddress || constraints.startLocation,
            city: geo.city || detectCityFromLocation(constraints.startLocation),
            latitude: geo.latitude,
            longitude: geo.longitude,
            placeId: geo.placeId || `geo-${geo.latitude}-${geo.longitude}`,
          };
          latestConstraints = {
            ...latestConstraints,
            startLocation: geo.name || constraints.startLocation,
            startCoordinates: coords,
            startLocationInfo: locationInfo,
            returnLocation: constraints.sameReturnLocation
              ? (geo.name || constraints.startLocation)
              : constraints.returnLocation,
            returnCoordinates: constraints.sameReturnLocation
              ? coords
              : constraints.returnCoordinates,
          };
          onChangeConstraints(latestConstraints);
        }
      } catch (err) {
        console.warn('Geocoding on submit failed:', err);
      } finally {
        setIsLocating(false);
      }
    }

    if (!coords?.latitude || !coords?.longitude) {
      setLocationStatus({
        type: 'error',
        message: 'Could not resolve geographic coordinates for this location. Please pick a location from suggestions.',
      });
      return;
    }

    onSubmit(latestConstraints);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 mb-3 inline-flex items-center gap-1 transition-colors"
        >
          ← Change Planning Mode
        </button>
        <span className="block text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
          Step 2 of 4 • Set Trip Boundaries
        </span>
        <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">
          Tell us about your trip
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          These boundaries allow Smart City Explorer to calculate estimated transit times, costs, and return feasibility to prevent deadline misses.
        </p>
      </div>

      <div className="space-y-8">
        
        {/* SECTION 1: Locations */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Trip Waypoint Anchors</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Start Location */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                📍 Starting Location
              </label>

              <LocationAutocomplete
                id="start-location-input"
                value={constraints.startLocation}
                onChange={handleManualLocationChange}
                onSelectSuggestion={handleSelectSuggestion}
                onSelectCurrentLocation={handleUseCurrentLocation}
                placeholder="Search station, landmark, airport, hotel..."
              />

              {/* Geolocation Status Feedback */}
              {isLocating && (
                <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 py-1 animate-fade-in">
                  <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  <span>Requesting device coordinates...</span>
                </div>
              )}

              {locationStatus && (
                <div
                  className={`text-xs p-2.5 rounded-xl border flex items-start gap-2 animate-fade-in ${
                    locationStatus.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : locationStatus.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : locationStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {locationStatus.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : locationStatus.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug">{locationStatus.message}</span>
                </div>
              )}

              {/* Quick suggestion pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 self-center mr-1">Popular:</span>
                {POPULAR_START_LOCATIONS.slice(0, 3).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleSelectPreset(loc)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    {loc.split(' ')[0]} {loc.split(' ')[1] || ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Return Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  📍 Return Location
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={constraints.sameReturnLocation}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onChangeConstraints({
                        ...constraints,
                        sameReturnLocation: checked,
                        returnLocation: checked ? constraints.startLocation : constraints.returnLocation,
                      });
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Same as start</span>
                </label>
              </div>

              <LocationAutocomplete
                id="return-location-input"
                disabled={constraints.sameReturnLocation}
                value={constraints.sameReturnLocation ? constraints.startLocation : constraints.returnLocation}
                onChange={(val) =>
                  onChangeConstraints({
                    ...constraints,
                    returnLocation: val,
                    returnCoordinates: undefined,
                  })
                }
                onSelectSuggestion={(item) => {
                  const coords =
                    item.lat !== undefined && item.lon !== undefined
                      ? { latitude: item.lat, longitude: item.lon }
                      : undefined;
                  onChangeConstraints({
                    ...constraints,
                    returnLocation: item.name,
                    returnCoordinates: coords,
                  });
                }}
                placeholder="Where must you conclude your trip?"
              />
              <p className="text-[11px] text-slate-400">
                {constraints.sameReturnLocation
                  ? 'Locked to starting hub (e.g. returning for a train or parked vehicle).'
                  : 'Specify different hotel, airport terminal, or bus terminal.'}
              </p>
            </div>

          </div>
        </div>

        {/* SECTION 2: Available Time & Return Deadline */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">Time Window & Hard Deadline</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              Zero Missed Trains
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Trip Start Time
              </label>
              <input
                id="trip-start-time-input"
                type="time"
                value={constraints.startTime}
                onChange={(e) =>
                  onChangeConstraints({
                    ...constraints,
                    startTime: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-500 rounded-xl text-sm font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-400">When you step out</span>
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Target Exploration End
              </label>
              <input
                id="trip-end-time-input"
                type="time"
                value={constraints.endTime}
                onChange={(e) =>
                  onChangeConstraints({
                    ...constraints,
                    endTime: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-500 rounded-xl text-sm font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-400">Desired wrap-up</span>
            </div>

            {/* Return Deadline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-rose-700 flex items-center gap-1">
                <span>⏱️ Must Return By</span>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-extrabold">DEADLINE</span>
              </label>
              <input
                id="trip-deadline-input"
                type="time"
                value={constraints.returnDeadline}
                onChange={(e) =>
                  onChangeConstraints({
                    ...constraints,
                    returnDeadline: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 bg-rose-50/50 border border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl text-sm font-bold text-rose-950"
              />
              <span className="text-[11px] text-rose-600 font-medium">Hard cutoff (train/flight/meeting)</span>
            </div>

          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Our engine checks your destination visit times against this return deadline. If the circuit takes longer than this window, it flags the plan as impossible and offers an optimized subset.
            </span>
          </div>
        </div>

        {/* SECTION 3: Budget & Group Size */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Budget & Travelers</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Budget Input & Presets */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                💰 Exploration Budget (INR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-base font-bold text-slate-400">
                  {constraints.currency}
                </span>
                <input
                  id="budget-input"
                  type="number"
                  min="50"
                  step="50"
                  value={constraints.budget}
                  onChange={(e) =>
                    onChangeConstraints({
                      ...constraints,
                      budget: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 focus:bg-white border border-slate-300 focus:border-emerald-500 rounded-2xl text-lg font-extrabold text-slate-900"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Presets:</span>
                {[200, 350, 500, 1000, 1500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() =>
                      onChangeConstraints({
                        ...constraints,
                        budget: amt,
                      })
                    }
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      constraints.budget === amt
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* People Count */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                👥 Number of Explorers
              </label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      onChangeConstraints({
                        ...constraints,
                        peopleCount: num,
                      })
                    }
                    className={`flex-1 py-3 px-3 rounded-2xl border text-center font-bold text-sm transition-all ${
                      constraints.peopleCount === num
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {num} {num === 1 ? 'Person' : 'People'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Ticket entries multiply by group size; cab fares are shared.
              </p>
            </div>

          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back
          </button>

          <button
            id="trip-details-continue-btn"
            type="button"
            onClick={handleContinue}
            className="px-8 py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/10 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 text-base"
          >
            <span>
              {mode === 'manual' ? 'Proceed to Destination Selection' : 'Configure AI Recommendations'}
            </span>
            <ArrowRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

      </div>
    </div>
  );
};
