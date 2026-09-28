import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Clock,
  Wallet,
  Compass,
  Check,
  Plus,
  ArrowRight,
  RefreshCw,
  Sliders,
  Layers,
  Heart,
  X,
  MapPin,
  Info,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Destination, TripConstraints, PacePreference } from '../types';
import { INTEREST_CHIPS } from '../data/mockData';
import { detectCityFromLocation } from '../data/locationSuggestions';
import {
  searchPlaces,
  fetchNearbyRecommendationsWithExpansion,
  geocodeLocationName,
} from '../services/placesService';
import { rankDestinationsByRelevance } from '../services/recommendationRanking';
import { validateRecommendationGeographically } from '../utils/geoValidation';
import {
  formatDuration,
  formatCategoryName,
  getDestinationVisitDuration,
  getDestinationEstimatedDuration,
} from '../utils/calculator';

interface AIRecommendationsProps {
  constraints: TripConstraints;
  selectedDestinations: Destination[];
  onToggleDestination: (dest: Destination) => void;
  onChangeConstraints: (constraints: TripConstraints) => void;
  onProceedToFeasibility: () => void;
  onBack: () => void;
  onUpdateVisitDuration?: (destId: string, durationMinutes?: number) => void;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({
  constraints,
  selectedDestinations,
  onToggleDestination,
  onChangeConstraints,
  onProceedToFeasibility,
  onBack,
  onUpdateVisitDuration,
}) => {
  const [selectedInterests, setSelectedInterests] = useState<string[]>(constraints.interests || ['Nature', 'History']);
  const [pace, setPace] = useState<PacePreference>(constraints.pacePreference || 'balanced');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [hasGenerated, setHasGenerated] = useState<boolean>(true);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [realRecommendations, setRealRecommendations] = useState<Destination[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Request ID tracker to cancel and ignore stale in-flight responses across location switches
  const requestIdRef = useRef<number>(0);

  // Detect city or location name from current start or return location
  const effectiveLocation = useMemo(() => {
    return constraints.startLocation?.trim() || constraints.returnLocation?.trim() || '';
  }, [constraints.startLocation, constraints.returnLocation]);

  const currentCity = useMemo(() => {
    return detectCityFromLocation(effectiveLocation);
  }, [effectiveLocation]);

  // Toggle interest
  const toggleInterest = (interest: string) => {
    const updated = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(updated);
    onChangeConstraints({ ...constraints, interests: updated });
  };

  // Search places for AI recommendations
  const fetchRecommendations = async () => {
    const currentReqId = ++requestIdRef.current;

    let activeCoords = constraints.startCoordinates;
    if (!activeCoords?.latitude || !activeCoords?.longitude) {
      if (constraints.startLocationInfo?.latitude && constraints.startLocationInfo?.longitude) {
        activeCoords = {
          latitude: constraints.startLocationInfo.latitude,
          longitude: constraints.startLocationInfo.longitude,
        };
      }
    }

    // If coordinates are missing but a location name is present, resolve it before failing
    if (!activeCoords?.latitude || !activeCoords?.longitude) {
      if (effectiveLocation) {
        setIsGenerating(true);
        try {
          const geo = await geocodeLocationName(effectiveLocation);
          if (geo) {
            activeCoords = { latitude: geo.latitude, longitude: geo.longitude };
            const locationInfo = {
              name: geo.name || effectiveLocation,
              address: geo.formattedAddress || effectiveLocation,
              city: geo.city || detectCityFromLocation(effectiveLocation),
              latitude: geo.latitude,
              longitude: geo.longitude,
              placeId: geo.placeId || `geo-${geo.latitude}-${geo.longitude}`,
            };
            onChangeConstraints({
              ...constraints,
              startCoordinates: activeCoords,
              startLocationInfo: locationInfo,
              returnCoordinates: constraints.sameReturnLocation
                ? activeCoords
                : constraints.returnCoordinates,
            });
          }
        } catch (e) {
          console.warn('Geocoding effective location failed:', e);
        }
      }
    }

    // Check if another request started in the meantime
    if (requestIdRef.current !== currentReqId) return;

    if (!activeCoords?.latitude || !activeCoords?.longitude) {
      setRealRecommendations([]);
      setStatusMessage('No verified nearby places found.');
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setStatusMessage(null);
    setSkippedIds([]);

    const primaryInterest = selectedInterests.length > 0 ? selectedInterests[0] : undefined;

    try {
      const places = await fetchNearbyRecommendationsWithExpansion(
        {
          name: constraints.startLocationInfo?.name || constraints.startLocation || effectiveLocation || 'Start Location',
          address: constraints.startLocationInfo?.address,
          city: constraints.startLocationInfo?.city || detectCityFromLocation(effectiveLocation),
          latitude: activeCoords.latitude,
          longitude: activeCoords.longitude,
        },
        primaryInterest,
        6,
        constraints
      );

      // Verify request is still current
      if (requestIdRef.current !== currentReqId) return;

      // Strict post-search geographic validation
      const verified = places.filter((dest) => {
        const check = validateRecommendationGeographically(
          dest,
          {
            latitude: activeCoords!.latitude,
            longitude: activeCoords!.longitude,
            name: constraints.startLocation || effectiveLocation,
            address: constraints.startLocationInfo?.address,
            city: constraints.startLocationInfo?.city,
          },
          15
        );
        return check.isValid;
      });

      const withMatchReasons = verified.map((dest) => ({
        ...dest,
        matchReason: dest.matchReason || `Attraction located ${dest.distanceKm !== undefined ? `${dest.distanceKm} km` : ''} from your starting location`,
      }));

      setRealRecommendations(withMatchReasons);

      if (withMatchReasons.length === 0) {
        setStatusMessage('No verified nearby places found.');
      }
    } catch (err) {
      console.warn('Recommendation search failed:', err);
      if (requestIdRef.current === currentReqId) {
        setRealRecommendations([]);
        setStatusMessage('No verified nearby places found.');
      }
    } finally {
      if (requestIdRef.current === currentReqId) {
        setIsGenerating(false);
        setHasGenerated(true);
      }
    }
  };

  // Immediate and complete state purge whenever the starting location or coordinates change
  useEffect(() => {
    requestIdRef.current += 1;
    setRealRecommendations([]);
    setSkippedIds([]);
    setStatusMessage(null);
    if (constraints.startLocation || constraints.startCoordinates) {
      fetchRecommendations();
    }
  }, [
    constraints.startLocation,
    constraints.startCoordinates?.latitude,
    constraints.startCoordinates?.longitude,
    selectedInterests,
  ]);

  // Trigger AI generation refresh
  const handleGenerate = () => {
    fetchRecommendations();
  };

  // Filtered recommended places: strictly validated against current startCoordinates
  const recommendedPlaces = useMemo(() => {
    if (!constraints.startCoordinates?.latitude || !constraints.startCoordinates?.longitude) {
      return [];
    }

    const originLat = constraints.startCoordinates.latitude;
    const originLon = constraints.startCoordinates.longitude;

    const validCandidates = realRecommendations
      .filter((place) => !skippedIds.includes(place.id))
      .filter((place) => {
        const check = validateRecommendationGeographically(
          place,
          {
            latitude: originLat,
            longitude: originLon,
            name: constraints.startLocation,
            address: constraints.startLocationInfo?.address,
            city: constraints.startLocationInfo?.city,
          },
          15
        );
        return check.isValid;
      });

    return rankDestinationsByRelevance(validCandidates, {
      ...constraints,
      interests: selectedInterests,
    });
  }, [
    realRecommendations,
    skippedIds,
    selectedInterests,
    constraints,
  ]);

  const handleSkip = (placeId: string) => {
    setSkippedIds((prev) => [...prev, placeId]);
  };

  const handleAddAllTopPicks = () => {
    const topPicks = recommendedPlaces.slice(0, pace === 'relaxed' ? 2 : pace === 'balanced' ? 3 : 4);
    topPicks.forEach((p) => {
      if (!selectedDestinations.some((d) => d.id === p.id)) {
        onToggleDestination(p);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 pb-32">
      {/* Top Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 inline-flex items-center gap-1 transition-colors"
        >
          ← Back to Trip Boundaries
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Constraint-Aware Recommendation Engine</span>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">
          What are you interested in?
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Tell us what you love, and our engine will select real attractions near {effectiveLocation || 'your starting location'} clustered within your {constraints.currency}{constraints.budget} budget.
        </p>
      </div>

      {/* Configuration Card: Interests, Pace, Budget Quick Tune */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6 mb-10">
        
        {/* Interests selectable chips */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Your Interests (Tap to toggle)
          </label>
          <div className="flex flex-wrap gap-2.5">
            {INTEREST_CHIPS.map((chip) => {
              const isSelected = selectedInterests.includes(chip.label);
              return (
                <button
                  key={chip.label}
                  id={`interest-chip-${chip.label.toLowerCase().replace(/\s+/g, '-')}`}
                  type="button"
                  onClick={() => toggleInterest(chip.label)}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 scale-105'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                  }`}
                >
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Secondary Questions in a clean grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
          
          {/* How much time do you have? */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Available Time Window</span>
            </span>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="text-sm font-extrabold text-slate-900">
                {constraints.startTime} → {constraints.returnDeadline || constraints.endTime}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Calculated return limit from step 1
              </div>
            </div>
          </div>

          {/* Budget Limit */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Budget Cap</span>
            </span>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="text-sm font-extrabold text-slate-900">
                {constraints.currency}{constraints.budget} total
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                For {constraints.peopleCount || 1} {(constraints.peopleCount || 1) === 1 ? 'person' : 'people'}
              </div>
            </div>
          </div>

          {/* Pace Selection */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-sky-600" />
              <span>Preferred Pace</span>
            </span>
            <div className="flex gap-2">
              {(['relaxed', 'balanced', 'packed'] as PacePreference[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPace(p);
                    onChangeConstraints({ ...constraints, pacePreference: p });
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                    pace === p
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Generate / Refresh CTA Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching Real Nearby Places...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Recommendations</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Recommendations Results Section */}
      <div className="space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Personalized Recommendations
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isGenerating
                ? 'Searching Google Places API...'
                : `${recommendedPlaces.length} real places found near ${effectiveLocation}`}
            </p>
          </div>

          {recommendedPlaces.length > 0 && (
            <button
              onClick={handleAddAllTopPicks}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Top Picks ({pace === 'relaxed' ? 2 : pace === 'balanced' ? 3 : 4})</span>
            </button>
          )}
        </div>

        {/* Loading Spinner */}
        {isGenerating && (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-700">Searching authentic destinations nearby...</p>
            <p className="text-xs text-slate-400">Restricting query to your selected location area</p>
          </div>
        )}

        {/* Error / Empty message */}
        {!isGenerating && (statusMessage || recommendedPlaces.length === 0) && (
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              {statusMessage || 'No verified nearby places found.'}
            </p>
          </div>
        )}

        {/* Cards Grid */}
        {!isGenerating && recommendedPlaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedPlaces.map((place) => {
              const isSelected = selectedDestinations.some((d) => d.id === place.id);
              const visitMins = getDestinationVisitDuration(place);

              return (
                <div
                  key={place.id}
                  className={`bg-white rounded-3xl overflow-hidden border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                      : 'border-slate-200/90 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Place Photo with category badge */}
                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={place.image}
                        alt={place.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to category placeholder on image error
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                      {/* Top Category Badge */}
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
                          {formatCategoryName(place.category)}
                        </span>
                      </div>

                      {/* Dismiss / Skip */}
                      <button
                        onClick={() => handleSkip(place.id)}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white/80 hover:text-white flex items-center justify-center transition-colors"
                        title="Dismiss recommendation"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Place Name on Image */}
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <h4 className="font-extrabold text-base leading-snug drop-shadow-sm">
                          {place.name}
                        </h4>
                        {place.address && (
                          <p className="text-[11px] text-slate-200 flex items-center gap-1 mt-0.5 truncate drop-shadow-xs">
                            <MapPin className="w-3 h-3 shrink-0 text-emerald-400" />
                            <span className="truncate">{place.address}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-3">
                      {place.matchReason && (
                        <div className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200/60 text-teal-800 text-[11px] font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-teal-600 shrink-0" />
                          <span className="truncate">{place.matchReason}</span>
                        </div>
                      )}

                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {place.description}
                      </p>

                      {/* Visit Duration & Cost Metrics */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>~{formatDuration(visitMins)}</span>
                        </span>
                        <span className="font-bold text-emerald-700">
                          {place.entryCost > 0 ? `${constraints.currency}${place.entryCost}` : 'Free Entry'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="p-5 pt-0">
                    <button
                      type="button"
                      onClick={() => onToggleDestination(place)}
                      className={`w-full py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Added to Trip</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add to My Trip</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-4 px-6 z-40 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Selected Sights
            </span>
            <span className="text-sm font-extrabold text-slate-900">
              {selectedDestinations.length} destinations chosen
            </span>
          </div>

          <button
            onClick={onProceedToFeasibility}
            disabled={selectedDestinations.length === 0}
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Run Feasibility Engine</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
