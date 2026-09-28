import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Check,
  Clock,
  MapPin,
  Tag,
  ArrowRight,
  Filter,
  Sparkles,
  Info,
  Trash2,
  Star,
  RefreshCw,
} from 'lucide-react';
import { Destination, TripConstraints } from '../types';
import { detectCityFromLocation } from '../data/locationSuggestions';
import {
  analyzeTripFeasibility,
  formatDuration,
  formatCategoryName,
  getDestinationVisitDuration,
  getDestinationEstimatedDuration,
  formatVisitDurationDisplay,
} from '../utils/calculator';
import {
  searchPlaces,
  fetchNearbyRecommendationsWithExpansion,
  validateAndLogRecommendations,
  geocodeLocationName,
} from '../services/placesService';
import { validateRecommendationGeographically } from '../utils/geoValidation';

interface DestinationSelectionProps {
  constraints: TripConstraints;
  selectedDestinations: Destination[];
  onToggleDestination: (dest: Destination) => void;
  onClearDestinations: () => void;
  onCheckPlan: () => void;
  onBack: () => void;
  onUpdateVisitDuration?: (destId: string, durationMinutes?: number) => void;
}

export const DestinationSelection: React.FC<DestinationSelectionProps> = ({
  constraints,
  selectedDestinations,
  onToggleDestination,
  onClearDestinations,
  onCheckPlan,
  onBack,
  onUpdateVisitDuration,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [realPlaces, setRealPlaces] = useState<Destination[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState<boolean>(false);
  const [placesStatusMessage, setPlacesStatusMessage] = useState<string | null>(null);

  // Request ID tracker to cancel and ignore stale in-flight search responses
  const requestIdRef = useRef<number>(0);

  // Active location context from starting or return location
  const effectiveLocation = useMemo(() => {
    return constraints.startLocation?.trim() || constraints.returnLocation?.trim() || '';
  }, [constraints.startLocation, constraints.returnLocation]);

  // Active city detected from user's starting or return location
  const currentCity = useMemo(() => {
    return detectCityFromLocation(effectiveLocation);
  }, [effectiveLocation]);

  // Categories list
  const categories = ['All', 'Nature', 'History', 'Culture', 'Scenic places', 'Food'];

  // Handle Search Real Places
  const handleSearchRealPlaces = async (customQuery?: string) => {
    const currentReqId = ++requestIdRef.current;
    setIsLoadingPlaces(true);
    setPlacesStatusMessage(null);

    const rawSearch = (typeof customQuery === 'string' ? customQuery : searchQuery).trim();
    let activeCoords = constraints.startCoordinates;
    if (!activeCoords?.latitude || !activeCoords?.longitude) {
      if (constraints.startLocationInfo?.latitude && constraints.startLocationInfo?.longitude) {
        activeCoords = {
          latitude: constraints.startLocationInfo.latitude,
          longitude: constraints.startLocationInfo.longitude,
        };
      }
    }

    // If starting coordinates are missing, attempt to geocode the effectiveLocation
    if (!activeCoords?.latitude || !activeCoords?.longitude) {
      if (effectiveLocation) {
        try {
          const geo = await geocodeLocationName(effectiveLocation);
          if (geo) {
            activeCoords = { latitude: geo.latitude, longitude: geo.longitude };
          }
        } catch (e) {
          console.warn('Geocoding in destination selection failed:', e);
        }
      }
    }

    if (requestIdRef.current !== currentReqId) return;

    if (!activeCoords?.latitude || !activeCoords?.longitude) {
      setIsLoadingPlaces(false);
      setRealPlaces([]);
      setPlacesStatusMessage('No verified nearby places found.');
      return;
    }

    try {
      if (!rawSearch && activeCoords) {
        // Direct coordinate-centered Nearby search with progressive expansion (Immediate -> Short trip -> Wider local area)
        const catParam = selectedCategory === 'All' ? undefined : selectedCategory;
        const places = await fetchNearbyRecommendationsWithExpansion(
          {
            name: constraints.startLocationInfo?.name || constraints.startLocation || effectiveLocation || 'Start Location',
            address: constraints.startLocationInfo?.address,
            city: constraints.startLocationInfo?.city || currentCity,
            latitude: activeCoords.latitude,
            longitude: activeCoords.longitude,
          },
          catParam,
          6,
          constraints
        );

        if (requestIdRef.current !== currentReqId) return;

        const validated = places.filter((p) => {
          const check = validateRecommendationGeographically(
            p,
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

        setRealPlaces(validated);
        if (validated.length === 0) {
          setPlacesStatusMessage('No verified nearby places found.');
        } else {
          setPlacesStatusMessage(null);
        }
      } else {
        // User typed a specific search query in search bar
        const results = await searchPlaces({
          query: rawSearch,
          location: activeCoords
            ? {
                latitude: activeCoords.latitude,
                longitude: activeCoords.longitude,
              }
            : undefined,
          radiusMeters: 10000,
        });

        if (requestIdRef.current !== currentReqId) return;

        if (!results || results.length === 0) {
          setPlacesStatusMessage('No verified nearby places found.');
          setRealPlaces([]);
        } else {
          const validated = validateAndLogRecommendations(
            results,
            {
              name: constraints.startLocationInfo?.name || constraints.startLocation || effectiveLocation || 'Start Location',
              address: constraints.startLocationInfo?.address,
              city: constraints.startLocationInfo?.city || currentCity,
              latitude: activeCoords?.latitude,
              longitude: activeCoords?.longitude,
            },
            15,
            constraints
          );

          if (requestIdRef.current !== currentReqId) return;

          setRealPlaces(validated);
          if (validated.length === 0) {
            setPlacesStatusMessage('No verified nearby places found.');
          } else {
            setPlacesStatusMessage(null);
          }
        }
      }
    } catch (error) {
      console.warn('Places API search error:', error);
      if (requestIdRef.current === currentReqId) {
        setPlacesStatusMessage('No verified nearby places found.');
        setRealPlaces([]);
      }
    } finally {
      if (requestIdRef.current === currentReqId) {
        setIsLoadingPlaces(false);
      }
    }
  };

  // Immediate state purge whenever starting location or coordinates change
  useEffect(() => {
    requestIdRef.current += 1;
    setRealPlaces([]);
    setPlacesStatusMessage(null);
    if (constraints.startLocation || constraints.startCoordinates) {
      handleSearchRealPlaces();
    }
  }, [
    constraints.startLocation,
    constraints.startCoordinates?.latitude,
    constraints.startCoordinates?.longitude,
    selectedCategory,
  ]);

  // Available destinations strictly verified against current startCoordinates
  const availableDestinations = useMemo(() => {
    if (!constraints.startCoordinates?.latitude || !constraints.startCoordinates?.longitude) {
      return [];
    }

    const originLat = constraints.startCoordinates.latitude;
    const originLon = constraints.startCoordinates.longitude;

    return realPlaces.filter((place) => {
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
  }, [
    realPlaces,
    constraints.startCoordinates?.latitude,
    constraints.startCoordinates?.longitude,
    constraints.startLocation,
    constraints.startLocationInfo,
  ]);

  // Filtered destinations
  const filteredDestinations = useMemo(() => {
    return availableDestinations.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.address && item.address.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'All' ||
        item.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase() === selectedCategory.toLowerCase()) ||
        (selectedCategory === 'Nature' && (item.category === 'park' || item.category === 'viewpoint')) ||
        (selectedCategory === 'History' && item.category === 'historical') ||
        (selectedCategory === 'Culture' && (item.category === 'temple' || item.category === 'museum')) ||
        (selectedCategory === 'Scenic places' && (item.category === 'viewpoint' || item.category === 'landmark' || item.category === 'park')) ||
        (selectedCategory === 'Food' && item.category === 'food');

      return matchesSearch && matchesCat;
    });
  }, [availableDestinations, searchQuery, selectedCategory]);

  // Live quick estimation
  const quickAnalysis = useMemo(() => {
    return analyzeTripFeasibility(constraints, selectedDestinations);
  }, [constraints, selectedDestinations]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 pb-32">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 inline-flex items-center gap-1 transition-colors"
          >
            ← Adjust Constraints
          </button>
          <span className="block text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
            Step 3 of 4 • Select Stops
          </span>
          <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">
            Where do you want to go?
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Select destinations you wish to visit. The system tracks duration and expenses against your {constraints.currency}{constraints.budget} budget.
          </p>
        </div>

        {/* Search Bar & Real Places Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              id="search-destinations-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchRealPlaces();
                }
              }}
              placeholder={
                effectiveLocation
                  ? `Search destinations in ${currentCity || effectiveLocation}...`
                  : 'Search for a city or place (e.g. Kanchipuram)...'
              }
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl text-sm font-medium shadow-xs"
            />
          </div>

          <button
            id="search-real-places-btn"
            type="button"
            onClick={() => handleSearchRealPlaces()}
            disabled={isLoadingPlaces}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
          >
            {isLoadingPlaces ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Searching places...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search real places</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Places Status Message Banner */}
      {placesStatusMessage && (
        <div className="mb-6 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2 shadow-xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{placesStatusMessage}</span>
        </div>
      )}

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        <Filter className="w-4 h-4 text-slate-400 shrink-0 ml-1 mr-1" />
        {categories.map((cat) => (
          <button
            key={cat}
            id={`filter-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Destinations Grid */}
      {filteredDestinations.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDestinations.map((place) => {
            const isSelected = selectedDestinations.some((d) => d.id === place.id);
            const selectedMatch = selectedDestinations.find((d) => d.id === place.id);
            const activePlace = selectedMatch || place;
            const estDuration = getDestinationEstimatedDuration(activePlace);
            const hasCustomDuration =
              typeof activePlace.userVisitMinutes === 'number' &&
              activePlace.userVisitMinutes > 0 &&
              activePlace.userVisitMinutes !== estDuration;
            const currentDuration = getDestinationVisitDuration(activePlace);

            return (
              <div
                key={place.id}
                id={`destination-card-${place.id}`}
                className={`group bg-white rounded-3xl overflow-hidden border-2 transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-500 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
                }`}
              >
                {/* Image & Badges */}
                <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={place.image}
                    alt={place.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  
                  {/* Category Pill */}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-md text-slate-800 shadow-xs">
                    {formatCategoryName(place.category)}
                  </span>

                  {/* Selected Status Overlay */}
                  {isSelected && (
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                      <Check className="w-3.5 h-3.5" /> Added
                    </span>
                  )}

                  {/* Quick Info bar on bottom of image */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white font-medium">
                    <span className="flex items-center gap-1 bg-slate-900/70 backdrop-blur-xs px-2 py-0.5 rounded-lg">
                      <Clock className="w-3 h-3 text-amber-300" />
                      {hasCustomDuration ? `Planned: ${currentDuration}m` : `Est. visit: ${estDuration}m`}
                    </span>
                    {place.rating ? (
                      <span className="flex items-center gap-1 bg-slate-900/70 backdrop-blur-xs px-2 py-0.5 rounded-lg text-amber-300 font-bold">
                        <Star className="w-3 h-3 fill-amber-300 text-amber-300" /> {place.rating}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-slate-900/70 backdrop-blur-xs px-2 py-0.5 rounded-lg">
                        <MapPin className="w-3 h-3 text-emerald-300" /> {place.distanceKm} km
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                        {place.name}
                      </h3>
                      <span className="shrink-0 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                        {place.feeUnknown || place.isFeeUnknown
                          ? '₹0 entry (Est.)'
                          : place.entryCost === 0
                          ? '₹0 entry'
                          : `₹${place.entryCost} entry`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {place.description}
                    </p>

                    {/* Highlights / Address */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {place.highlights.slice(0, 2).map((hl) => (
                        <span
                          key={hl}
                          className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100"
                        >
                          • {hl}
                        </span>
                      ))}
                    </div>

                    {/* Visit Duration Specification */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1 text-slate-600 font-semibold">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Estimated visit time: {estDuration} min
                        </span>
                        {hasCustomDuration && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateVisitDuration?.(place.id, undefined);
                            }}
                            className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                          >
                            Reset to estimate
                          </button>
                        )}
                      </div>

                      {isSelected ? (
                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              {hasCustomDuration ? 'Your planned visit time:' : 'Planned visit time:'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = Math.max(10, currentDuration - 15);
                                  onUpdateVisitDuration?.(place.id, next);
                                }}
                                className="w-6 h-6 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-extrabold text-slate-700 text-xs shadow-2xs cursor-pointer active:scale-95 transition-all"
                                title="Decrease planned visit by 15 min"
                              >
                                -
                              </button>
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs font-extrabold min-w-[52px] text-center ${
                                  hasCustomDuration
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-900'
                                }`}
                              >
                                {currentDuration}m
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = Math.min(240, currentDuration + 15);
                                  onUpdateVisitDuration?.(place.id, next);
                                }}
                                className="w-6 h-6 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-extrabold text-slate-700 text-xs shadow-2xs cursor-pointer active:scale-95 transition-all"
                                title="Increase planned visit by 15 min"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] text-emerald-800 font-medium">
                            {hasCustomDuration ? (
                              <span className="font-bold">Your planned visit time: {currentDuration} min</span>
                            ) : (
                              <span className="text-slate-500 italic">Estimated visit time: {estDuration} min (Planning estimate)</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">
                          Planning estimate • Adjustable when added
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add / Remove Button */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      id={`toggle-dest-btn-${place.id}`}
                      type="button"
                      onClick={() => onToggleDestination(place)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove from trip</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Add to trip</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !isLoadingPlaces && (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center max-w-lg mx-auto my-8 space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <MapPin className="w-6 h-6 text-slate-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {!effectiveLocation && !searchQuery.trim()
                  ? 'Select a starting/return location to discover destinations.'
                  : placesStatusMessage || 'No verified nearby places found.'}
              </h3>
              <p className="text-xs text-slate-500">
                {!effectiveLocation && !searchQuery.trim()
                  ? 'Choose a starting location to discover nearby destinations.'
                  : 'Try adjusting your search keywords or search radius.'}
              </p>
            </div>
            {effectiveLocation ? (
              <button
                type="button"
                onClick={() => handleSearchRealPlaces()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search real places in {currentCity || effectiveLocation}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5"
              >
                <span>← Set Starting / Return Location</span>
              </button>
            )}
          </div>
        )
      )}

      {/* FLOATING TRIP SUMMARY PANEL */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Quick Metrics */}
          <div className="flex items-center gap-6 text-xs text-slate-700">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Selected</span>
              <span className="font-extrabold text-sm text-slate-900">
                {selectedDestinations.length} {selectedDestinations.length === 1 ? 'place' : 'places'}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Estimated Time</span>
              <span className="font-extrabold text-sm text-slate-900">
                {formatDuration(quickAnalysis.timeUsedMinutes)}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">
                / {formatDuration(quickAnalysis.timeAvailableMinutes)} avail
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Estimated Cost</span>
              <span className="font-extrabold text-sm text-slate-900">
                {constraints.currency}{quickAnalysis.totalCost}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">
                / {constraints.currency}{constraints.budget} cap
              </span>
            </div>

            {/* Quick Warning pill if exceeding */}
            {!quickAnalysis.isFeasible && selectedDestinations.length > 0 && (
              <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                ⚠️ Plan exceeds constraints (Verification will suggest alternative)
              </span>
            )}
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {selectedDestinations.length > 0 && (
              <button
                type="button"
                onClick={onClearDestinations}
                className="text-xs text-slate-500 hover:text-rose-600 px-3 py-2 font-medium"
              >
                Clear all
              </button>
            )}

            <button
              id="check-my-plan-btn"
              type="button"
              disabled={selectedDestinations.length === 0}
              onClick={onCheckPlan}
              className={`flex-1 sm:flex-initial px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                selectedDestinations.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
              }`}
            >
              <span>Choose Transportation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
