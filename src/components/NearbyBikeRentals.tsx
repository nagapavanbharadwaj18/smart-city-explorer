import React, { useState, useEffect, useRef } from 'react';
import { Bike, MapPin, Star, Phone, Globe, Loader2, AlertCircle, Info } from 'lucide-react';
import { RentalBusiness, findNearbyBikeRentals } from '../services/rentalService';

interface NearbyBikeRentalsProps {
  startLocation: string;
  startCoordinates?: { latitude: number; longitude: number };
  onSelectRentalShop?: (shop: RentalBusiness) => void;
  selectedShopId?: string;
}

export const NearbyBikeRentals: React.FC<NearbyBikeRentalsProps> = ({
  startLocation,
  startCoordinates,
  onSelectRentalShop,
  selectedShopId,
}) => {
  const [rentals, setRentals] = useState<RentalBusiness[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [activeLocationName, setActiveLocationName] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmedLocation = startLocation?.trim() || '';

    // Cancel any ongoing fetch for a previous location
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Rule 7 & 8: If no starting location, do NOT search, clear rentals immediately
    if (!trimmedLocation) {
      setRentals([]);
      setIsLoading(false);
      setSearched(false);
      setActiveLocationName('');
      return;
    }

    // Immediately clear previous location's businesses so they are never retained
    setRentals([]);
    setIsLoading(true);
    setSearched(false);
    setActiveLocationName(trimmedLocation);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Small debounce to avoid flashing while user types in autocomplete
    const timer = setTimeout(async () => {
      try {
        const result = await findNearbyBikeRentals(trimmedLocation, {
          coordinates: startCoordinates,
          radiusMeters: 5000,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setRentals(result.businesses);
          setSearched(true);
          setIsLoading(false);
          if (result.center?.name) {
            setActiveLocationName(result.center.name);
          }
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          console.warn('Error fetching bike rentals:', err);
          setRentals([]);
          setSearched(true);
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [startLocation, startCoordinates]);

  const hasStartLocation = Boolean(startLocation?.trim());
  const cleanDisplayName = activeLocationName || startLocation.trim();

  return (
    <div
      id="nearby-bike-rentals-section"
      className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-700">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {hasStartLocation ? `Bike Rentals near ${cleanDisplayName}` : 'Nearby Bike Rentals'}
            </h3>
            <p className="text-xs text-slate-500">
              Pick up a rental vehicle near your trip starting point for self-drive flexibility
            </p>
          </div>
        </div>

        {hasStartLocation && rentals.length > 0 && !isLoading && (
          <span className="text-xs font-extrabold bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-full">
            {rentals.length} available
          </span>
        )}
      </div>

      {/* Case 1: No starting location selected */}
      {!hasStartLocation && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-600 text-sm flex items-center gap-3">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Select a starting location to find nearby bike rentals.</span>
        </div>
      )}

      {/* Case 2: Loading State */}
      {hasStartLocation && isLoading && (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="text-xs font-semibold">
            Searching for verified bike & two-wheeler rentals near {cleanDisplayName}...
          </span>
        </div>
      )}

      {/* Case 3: Searched and no businesses found */}
      {hasStartLocation && !isLoading && searched && rentals.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">
              No suitable bike rental businesses found within the search area around your starting location.
            </p>
            <p className="text-xs text-amber-700">
              Normal transport options (two-wheeler, taxi / ride-hailing, public transit, walking) remain fully available. You can continue with standard transport below.
            </p>
          </div>
        </div>
      )}

      {/* Case 4: Results found */}
      {hasStartLocation && !isLoading && rentals.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {rentals.map((biz) => {
              const isSelected = selectedShopId === biz.placeId;
              return (
                <div
                  key={biz.placeId}
                  onClick={() => onSelectRentalShop?.(biz)}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
                    onSelectRentalShop ? 'cursor-pointer hover:shadow-sm' : ''
                  } ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/70 shadow-xs ring-2 ring-teal-200'
                      : 'border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header: Name + Distance & Travel Time */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0 animate-pulse" />
                        )}
                        <h4 className="font-extrabold text-sm text-slate-900 leading-snug truncate">
                          {biz.name}
                        </h4>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 border border-teal-200">
                          {biz.distanceKm.toFixed(1)} km
                        </span>
                        <span className="text-[10px] text-teal-700 font-semibold">
                          {biz.estimatedTravelTimeFormatted || `~${biz.estimatedTravelMinutes} min travel`}
                        </span>
                      </div>
                    </div>

                    {/* Address */}
                    <p className="text-xs text-slate-600 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{biz.address}</span>
                    </p>

                    {/* Coordinates & Place ID metadata */}
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-100 pt-1.5">
                      <span>Coords: {biz.latitude.toFixed(4)}, {biz.longitude.toFixed(4)}</span>
                      <span className="truncate max-w-[120px]" title={biz.placeId}>ID: {biz.placeId.slice(-8)}</span>
                    </div>

                    {/* Opening Status & Hours */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] pt-1 border-t border-slate-100">
                      {biz.openingStatusText ? (
                        <span
                          className={`inline-flex items-center gap-1 font-semibold text-[10px] px-2 py-0.5 rounded-md ${
                            biz.openNow
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              biz.openNow ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                          <span>{biz.openingStatusText}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Hours: Inquire locally</span>
                      )}

                      {biz.regularOpeningHours && biz.regularOpeningHours.length > 0 && (
                        <span className="text-[10px] text-slate-500 truncate max-w-[180px]" title={biz.regularOpeningHours[0]}>
                          {biz.regularOpeningHours[0]}
                        </span>
                      )}
                    </div>

                    {/* Rental Price (Never invented) */}
                    <div className="text-[11px] text-slate-600 bg-slate-100/90 px-2.5 py-1.5 rounded-xl flex items-center justify-between border border-slate-200/60">
                      <span className="font-semibold text-slate-700">Rental Tariff:</span>
                      <span className="text-slate-500 font-medium italic text-[10px]">
                        {biz.rentalPriceInfo || 'Rental price unavailable — check with the business.'}
                      </span>
                    </div>

                    {/* Active Trip Sequence Banner if selected */}
                    {isSelected && (
                      <div className="bg-teal-600 text-white rounded-xl p-2.5 text-[11px] font-semibold space-y-1 shadow-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>✓ Added to Trip Sequence</span>
                        </div>
                        <p className="text-[10px] text-teal-100 leading-snug">
                          START → Travel to {biz.name} ({biz.distanceKm.toFixed(1)} km, {biz.estimatedTravelTimeFormatted}) → Pick Up Bike (10 min) → Tour Destinations → Return
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Rating, Phone, Website, and Select Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                    {biz.rating !== undefined ? (
                      <div className="flex items-center gap-1 font-bold text-amber-700">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{biz.rating.toFixed(1)}</span>
                        {biz.userRatingsTotal !== undefined && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({biz.userRatingsTotal})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Verified rental business</span>
                    )}

                    <div className="flex items-center gap-2">
                      {biz.phoneNumber && (
                        <a
                          href={`tel:${biz.phoneNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-medium"
                          title={biz.phoneNumber}
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>Call</span>
                        </a>
                      )}
                      {biz.website && (
                        <a
                          href={biz.website}
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900 font-bold"
                        >
                          <Globe className="w-3 h-3 text-teal-600" />
                          <span>Website</span>
                        </a>
                      )}
                      {onSelectRentalShop && (
                        <span
                          className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-teal-700 text-white shadow-2xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? '✓ Selected Pickup' : 'Select for Trip Flow'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 italic">
            * Selected rental shop is automatically added as your first journey waypoint. Vehicle tariffs and deposit terms must be verified directly with the business.
          </p>
        </div>
      )}
    </div>
  );
};
