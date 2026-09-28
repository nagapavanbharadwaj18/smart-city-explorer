import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Train,
  Plane,
  Bus,
  Landmark,
  Building,
  Bed,
  Crosshair,
  Search,
  X,
  Navigation,
  Loader2,
  Globe2,
} from 'lucide-react';
import {
  LocationSuggestion,
  searchLocations,
  searchLocationsOnline,
  geocodeLocationName,
} from '../data/locationSuggestions';

interface LocationAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: LocationSuggestion) => void;
  onSelectCurrentLocation?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  id,
  value,
  onChange,
  onSelectSuggestion,
  onSelectCurrentLocation,
  placeholder = 'Search any city, station, airport, landmark...',
  disabled = false,
  className = '',
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update suggestions on input change: immediate local results + debounced live geocoding
  useEffect(() => {
    // 1. Immediate synchronous local search (instant response)
    const local = searchLocations(value);
    setSuggestions(local);
    setHighlightedIndex(-1);

    if (!value.trim()) {
      setIsLoading(false);
      return;
    }

    // 2. Debounced online worldwide geocoding
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const onlineResults = await searchLocationsOnline(value, controller.signal);
        setSuggestions(onlineResults);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (item: LocationSuggestion) => {
    let resolvedItem = item;
    if (resolvedItem.lat === undefined || resolvedItem.lon === undefined) {
      const geo = await geocodeLocationName(resolvedItem.name);
      if (geo) {
        resolvedItem = {
          ...resolvedItem,
          lat: geo.latitude,
          lon: geo.longitude,
        };
      }
    }

    onChange(resolvedItem.name);
    if (onSelectSuggestion) {
      onSelectSuggestion(resolvedItem);
    }
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelect(suggestions[highlightedIndex]);
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getLocationIcon = (type: LocationSuggestion['type']) => {
    switch (type) {
      case 'station':
        return <Train className="w-4 h-4 text-emerald-600" />;
      case 'airport':
        return <Plane className="w-4 h-4 text-sky-600" />;
      case 'bus_terminal':
        return <Bus className="w-4 h-4 text-amber-600" />;
      case 'landmark':
        return <Landmark className="w-4 h-4 text-indigo-600" />;
      case 'hotel':
        return <Bed className="w-4 h-4 text-purple-600" />;
      case 'commercial':
        return <Building className="w-4 h-4 text-teal-600" />;
      case 'city':
        return <Globe2 className="w-4 h-4 text-emerald-700" />;
      default:
        return <MapPin className="w-4 h-4 text-slate-500" />;
    }
  };

  // Helper to safely escape special characters for RegExp construction
  const escapeRegExp = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Highlight query match in text
  const renderHighlightedText = (text: string, query: string) => {
    if (!text) return null;
    const trimmed = query.trim();
    if (!trimmed) return <span>{text}</span>;
    try {
      const escaped = escapeRegExp(trimmed);
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) =>
            part.toLowerCase() === trimmed.toLowerCase() ? (
              <strong key={i} className="text-slate-950 font-extrabold underline decoration-emerald-500 decoration-2">
                {part}
              </strong>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
      );
    } catch {
      return <span>{text}</span>;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input container */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-10 pr-20 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border rounded-2xl text-sm font-medium transition-all outline-none ${
            disabled
              ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed'
              : isOpen
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white'
              : 'border-slate-300 focus:border-emerald-500'
          }`}
        />

        {/* Clear Button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-12 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            title="Clear text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Use Current Location Quick Icon Button */}
        {onSelectCurrentLocation && !disabled && (
          <button
            type="button"
            onClick={onSelectCurrentLocation}
            className="absolute right-2 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
            title="Use Device Location"
          >
            <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline text-[11px]">GPS</span>
          </button>
        )}
      </div>

      {/* Google Maps Style Autocomplete Dropdown List */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-fade-in max-h-80 overflow-y-auto divide-y divide-slate-100">
          
          {/* Top Option: Google Maps "Your current location" */}
          {onSelectCurrentLocation && (
            <div
              onClick={() => {
                onSelectCurrentLocation();
                setIsOpen(false);
              }}
              className="px-4 py-3 hover:bg-emerald-50/70 cursor-pointer flex items-center gap-3 transition-colors group border-b border-slate-100"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Navigation className="w-4 h-4 text-emerald-700 fill-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-emerald-900 group-hover:text-emerald-950">
                  Your current location
                </div>
                <div className="text-xs text-emerald-700/80">
                  Use device GPS coordinates anywhere
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                Nearby
              </span>
            </div>
          )}

          {/* Autocomplete Suggestions List */}
          {suggestions.length > 0 ? (
            suggestions.map((item, index) => {
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={item.id}
                  id={`autocomplete-item-${item.id}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-3 cursor-pointer flex items-start gap-3 transition-colors ${
                    isHighlighted ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Icon Circle */}
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0 mt-0.5">
                    {getLocationIcon(item.type)}
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {renderHighlightedText(item.name, value)}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {item.secondaryText}
                    </div>
                  </div>

                  {/* City & Type Pill */}
                  <div className="shrink-0 text-right space-y-1 pl-2">
                    {item.city && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 block truncate max-w-[110px]">
                        {item.city}
                      </span>
                    )}
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                      {item.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-500">
              <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              <span>Searching Google Maps / OpenStreetMap for "{value}"...</span>
            </div>
          )}

          {/* Footer bar */}
          <div className="px-4 py-2 bg-slate-50/80 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100">
            <span className="flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-emerald-600" />
              <span>Worldwide Geocoding: Any City, Town, or Landmark</span>
            </span>
            <span>Use ↑ ↓ keys + Enter</span>
          </div>

        </div>
      )}
    </div>
  );
};
