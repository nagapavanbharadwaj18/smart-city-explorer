import React, { useState, useEffect, useMemo } from 'react';
import { AppScreen, PlanningMode as ModeType, TripConstraints, Destination, FeasibilityResult } from './types';
import { INITIAL_CONSTRAINTS, MOCK_DESTINATIONS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { PlanningMode } from './components/PlanningMode';
import { TripDetails } from './components/TripDetails';
import { DestinationSelection } from './components/DestinationSelection';
import { AIRecommendations } from './components/AIRecommendations';
import { FeasibilityAnalysis } from './components/FeasibilityAnalysis';
import { ItineraryView } from './components/ItineraryView';
import { TripSummaryPanel } from './components/TripSummaryPanel';
import { TransportSelection } from './components/TransportSelection';
import { isDestinationGeographicallyCompatible, filterDestinationsByTripArea } from './utils/geoValidation';
import { getDestinationEstimatedDuration, analyzeTripFeasibility } from './utils/calculator';
import { RouteResult, computeTripLegs } from './services/routesService';
import { AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [planningMode, setPlanningMode] = useState<ModeType>('manual');
  const [constraints, setConstraints] = useState<TripConstraints>(INITIAL_CONSTRAINTS);
  const [selectedDestinations, setSelectedDestinations] = useState<Destination[]>([]);
  const [geoToast, setGeoToast] = useState<string | null>(null);
  const [routeLegsMap, setRouteLegsMap] = useState<Map<string, RouteResult> | undefined>(undefined);

  // Authoritative route calculation across all consecutive segments and return to origin
  useEffect(() => {
    let isMounted = true;
    if (selectedDestinations.length === 0 || !constraints.startLocation?.trim()) {
      setRouteLegsMap(undefined);
      return;
    }

    computeTripLegs(
      constraints.startLocation,
      selectedDestinations,
      constraints.sameReturnLocation ? constraints.startLocation : constraints.returnLocation,
      constraints.transportPreference,
      constraints.rentalPickupShop,
      constraints.segmentTransportModes,
      constraints.startCoordinates,
      constraints.sameReturnLocation ? constraints.startCoordinates : constraints.returnCoordinates,
      constraints.sameReturnLocation
    )
      .then((legs) => {
        if (isMounted) {
          setRouteLegsMap(legs);
        }
      })
      .catch((err) => {
        console.warn('Unified routes calculation fallback engaged:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [
    selectedDestinations,
    constraints.startLocation,
    constraints.returnLocation,
    constraints.sameReturnLocation,
    constraints.transportPreference,
    constraints.rentalPickupShop,
    constraints.segmentTransportModes,
    constraints.startCoordinates,
    constraints.returnCoordinates,
  ]);

  // Single authoritative Feasibility & Itinerary analysis consumed by Summary, Feasibility, and Itinerary
  const sharedFeasibilityResult: FeasibilityResult = useMemo(() => {
    return analyzeTripFeasibility(constraints, selectedDestinations, {
      routeLegsMap,
    });
  }, [constraints, selectedDestinations, routeLegsMap]);

  const showGeoToast = (msg: string) => {
    setGeoToast(msg);
    setTimeout(() => {
      setGeoToast((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Handle constraints update with geographic revalidation
  const handleChangeConstraints = (newConstraints: TripConstraints) => {
    setConstraints(newConstraints);
    const newLocation = newConstraints.startLocation?.trim() || newConstraints.returnLocation?.trim() || '';
    const oldLocation = constraints.startLocation?.trim() || constraints.returnLocation?.trim() || '';

    if (newLocation !== oldLocation) {
      setRouteLegsMap(undefined);
      if (newLocation) {
        setSelectedDestinations((prev) => {
          const { valid, rejected } = filterDestinationsByTripArea(
            prev,
            newLocation,
            newConstraints.startCoordinates
          );
          if (rejected.length > 0) {
            showGeoToast(
              `Removed ${rejected.length} destination${rejected.length > 1 ? 's' : ''} not located in ${newLocation}.`
            );
          }
          return valid;
        });
      }
    }
  };

  // Destination toggle handler with strict geographic validation
  const handleToggleDestination = (dest: Destination) => {
    setRouteLegsMap(undefined);
    setSelectedDestinations((prev) => {
      const exists = prev.some((d) => d.id === dest.id);
      if (exists) {
        return prev.filter((d) => d.id !== dest.id);
      } else {
        const tripLocation = constraints.startLocation?.trim() || constraints.returnLocation?.trim() || '';
        const check = isDestinationGeographicallyCompatible(
          dest,
          tripLocation,
          70,
          constraints.startCoordinates
        );
        if (!check.isCompatible) {
          showGeoToast(
            tripLocation
              ? `This destination is outside your selected trip area (${tripLocation}).`
              : 'Please choose a starting location or city to discover destinations.'
          );
          return prev;
        }
        return [...prev, dest];
      }
    });
  };

  const handleClearDestinations = () => {
    setSelectedDestinations([]);
    setRouteLegsMap(undefined);
  };

  // Preset Scenario Loaders for Hackathon Judges
  const handleLoadPreset = (
    presetType: 'feasible' | 'impossible' | 'budget_fail' | 'deadline_fail' | 'multi_fail'
  ) => {
    if (presetType === 'feasible') {
      setConstraints({
        ...INITIAL_CONSTRAINTS,
        startLocation: 'Vijayawada Central Railway Station',
        returnLocation: 'Vijayawada Central Railway Station',
        startTime: '13:00',
        endTime: '17:00',
        returnDeadline: '17:30',
        budget: 500,
        peopleCount: 1,
        transportPreference: 'auto_cab',
      });
      setSelectedDestinations([
        MOCK_DESTINATIONS[0], // Prakasam Barrage (45m, ₹0)
        MOCK_DESTINATIONS[1], // Undavalli Caves (60m, ₹25)
        MOCK_DESTINATIONS[5], // Gandhi Hill (40m, ₹15)
      ]);
      setCurrentScreen('feasibility');
    } else if (presetType === 'impossible') {
      // Overbooked 5 destinations in only 3h window
      setConstraints({
        ...INITIAL_CONSTRAINTS,
        startLocation: 'Vijayawada Central Railway Station',
        returnLocation: 'Vijayawada Central Railway Station',
        startTime: '13:00',
        endTime: '16:00', // only 3 hours
        returnDeadline: '16:15',
        budget: 400,
        peopleCount: 1,
        transportPreference: 'auto_cab',
      });
      setSelectedDestinations([
        MOCK_DESTINATIONS[0], // Prakasam Barrage
        MOCK_DESTINATIONS[1], // Undavalli Caves
        MOCK_DESTINATIONS[4], // Bhavani Island (90 min)
        MOCK_DESTINATIONS[2], // Kanaka Durga (50 min)
        MOCK_DESTINATIONS[3], // Bapu Museum (45 min)
      ]);
      setCurrentScreen('feasibility');
    } else if (presetType === 'budget_fail') {
      // Budget limit ₹150 but selected multiple paid destinations
      setConstraints({
        ...INITIAL_CONSTRAINTS,
        startLocation: 'Vijayawada Central Railway Station',
        returnLocation: 'Vijayawada Central Railway Station',
        startTime: '12:00',
        endTime: '18:00',
        returnDeadline: '18:30',
        budget: 150, // Low budget
        peopleCount: 2, // 2 people
        transportPreference: 'auto_cab',
      });
      setSelectedDestinations([
        MOCK_DESTINATIONS[4], // Bhavani Island (₹60 x 2 = ₹120)
        MOCK_DESTINATIONS[3], // Bapu Museum (₹50 x 2 = ₹100)
        MOCK_DESTINATIONS[1], // Undavalli Caves (₹25 x 2 = ₹50)
      ]);
      setCurrentScreen('feasibility');
    } else if (presetType === 'deadline_fail') {
      // Return deadline failure: starts 14:00 with strict 15:40 deadline
      setConstraints({
        ...INITIAL_CONSTRAINTS,
        startLocation: 'Vijayawada Central Railway Station',
        returnLocation: 'Vijayawada Central Railway Station',
        startTime: '14:00',
        endTime: '15:30',
        returnDeadline: '15:40',
        budget: 700,
        peopleCount: 1,
        transportPreference: 'auto_cab',
      });
      setSelectedDestinations([
        MOCK_DESTINATIONS[4], // Bhavani Island (90m dwell + transit)
        MOCK_DESTINATIONS[1], // Undavalli Caves (60m dwell + transit)
      ]);
      setCurrentScreen('feasibility');
    } else if (presetType === 'multi_fail') {
      // Multi-constraint failure: budget and deadline both violated
      setConstraints({
        ...INITIAL_CONSTRAINTS,
        startLocation: 'Vijayawada Central Railway Station',
        returnLocation: 'Vijayawada Central Railway Station',
        startTime: '14:00',
        endTime: '16:00',
        returnDeadline: '16:15',
        budget: 100, // Very low budget for 2 people
        peopleCount: 2,
        transportPreference: 'auto_cab',
      });
      setSelectedDestinations([
        MOCK_DESTINATIONS[4], // Bhavani Island (₹120 for 2)
        MOCK_DESTINATIONS[3], // Bapu Museum (₹100 for 2)
        MOCK_DESTINATIONS[1], // Undavalli Caves (₹50 for 2)
      ]);
      setCurrentScreen('feasibility');
    }
  };

  const handleReset = () => {
    setConstraints(INITIAL_CONSTRAINTS);
    setSelectedDestinations([]);
    setRouteLegsMap(undefined);
    setCurrentScreen('landing');
  };

  // Allow users to customize destination visit duration while preserving feasibility engine calculations
  const handleUpdateDestinationVisitDuration = (destId: string, durationMinutes?: number) => {
    setSelectedDestinations((prev) =>
      prev.map((d) => {
        if (d.id === destId) {
          const est = getDestinationEstimatedDuration(d);
          if (durationMinutes === undefined || durationMinutes === est) {
            const { userVisitMinutes, ...rest } = d;
            return {
              ...rest,
              visitDuration: est,
              visitDurationMinutes: est,
            };
          }
          return {
            ...d,
            userVisitMinutes: durationMinutes,
            visitDuration: durationMinutes,
            visitDurationMinutes: durationMinutes,
          };
        }
        return d;
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Toast for Geographic Constraints */}
      {geoToast && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-rose-900/95 text-white px-4 py-3 rounded-2xl shadow-xl border border-rose-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs font-medium leading-relaxed">
            {geoToast}
          </div>
          <button
            onClick={() => setGeoToast(null)}
            className="text-rose-300 hover:text-white shrink-0 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Sticky Header */}
      <Navbar
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onReset={handleReset}
        onLoadPreset={handleLoadPreset}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* SCREEN 1: LANDING PAGE */}
        {currentScreen === 'landing' && (
          <LandingPage
            onStartPlanning={() => setCurrentScreen('mode_select')}
            onExploreFeasibleDemo={() => handleLoadPreset('feasible')}
            onExploreImpossibleDemo={() => handleLoadPreset('impossible')}
          />
        )}

        {/* SCREEN 2: CHOOSE PLANNING MODE */}
        {currentScreen === 'mode_select' && (
          <PlanningMode
            onSelectMode={(mode) => {
              setPlanningMode(mode);
              setCurrentScreen('trip_details');
            }}
            onBack={() => setCurrentScreen('landing')}
          />
        )}

        {/* SCREEN 3: TRIP DETAILS BOUNDARIES */}
        {currentScreen === 'trip_details' && (
          <TripDetails
            constraints={constraints}
            mode={planningMode}
            onChangeConstraints={handleChangeConstraints}
            onSubmit={(updatedConstraints) => {
              if (updatedConstraints) {
                handleChangeConstraints(updatedConstraints);
              }
              if (planningMode === 'manual') {
                setCurrentScreen('destination_select');
              } else {
                setCurrentScreen('ai_recommend');
              }
            }}
            onBack={() => setCurrentScreen('mode_select')}
          />
        )}

        {/* SCREEN 4: DESTINATION SELECTION ("I know where I want to go") */}
        {currentScreen === 'destination_select' && (
          <DestinationSelection
            constraints={constraints}
            selectedDestinations={selectedDestinations}
            onToggleDestination={handleToggleDestination}
            onClearDestinations={handleClearDestinations}
            onCheckPlan={() => setCurrentScreen('transport_select')}
            onBack={() => setCurrentScreen('trip_details')}
            onUpdateVisitDuration={handleUpdateDestinationVisitDuration}
          />
        )}

        {/* SCREEN 5: AI RECOMMENDATIONS */}
        {currentScreen === 'ai_recommend' && (
          <AIRecommendations
            constraints={constraints}
            selectedDestinations={selectedDestinations}
            onToggleDestination={handleToggleDestination}
            onChangeConstraints={handleChangeConstraints}
            onProceedToFeasibility={() => setCurrentScreen('transport_select')}
            onBack={() => setCurrentScreen('trip_details')}
            onUpdateVisitDuration={handleUpdateDestinationVisitDuration}
          />
        )}

        {/* SCREEN: TRANSPORTATION SELECTION (After destinations are chosen) */}
        {currentScreen === 'transport_select' && (
          <TransportSelection
            constraints={constraints}
            destinations={selectedDestinations}
            onChangeConstraints={handleChangeConstraints}
            onProceed={() => setCurrentScreen('feasibility')}
            onBack={() => {
              if (planningMode === 'ai_suggest') {
                setCurrentScreen('ai_recommend');
              } else {
                setCurrentScreen('destination_select');
              }
            }}
          />
        )}

        {/* SCREEN 6 & 7: FEASIBILITY ANALYSIS & IMPOSSIBLE PLAN */}
        {currentScreen === 'feasibility' && (
          <FeasibilityAnalysis
            constraints={constraints}
            selectedDestinations={selectedDestinations}
            feasibilityResult={sharedFeasibilityResult}
            routeLegsMap={routeLegsMap}
            onUseAlternativePlan={(altDests) => {
              setSelectedDestinations(altDests);
              setCurrentScreen('itinerary');
            }}
            onModifyPlan={() => setCurrentScreen('transport_select')}
            onProceedToItinerary={() => setCurrentScreen('itinerary')}
            onLoadImpossibleTest={() => handleLoadPreset('impossible')}
            onLoadFeasibleTest={() => handleLoadPreset('feasible')}
            onLoadPreset={handleLoadPreset}
            onUpdateVisitDuration={handleUpdateDestinationVisitDuration}
          />
        )}

        {/* SCREEN 8: FINAL ITINERARY */}
        {currentScreen === 'itinerary' && (
          <ItineraryView
            constraints={constraints}
            destinations={selectedDestinations}
            feasibilityResult={sharedFeasibilityResult}
            routeLegsMap={routeLegsMap}
            onModifyPlan={() => setCurrentScreen('feasibility')}
            onReset={handleReset}
            onUpdateVisitDuration={handleUpdateDestinationVisitDuration}
          />
        )}

      </main>

      {/* Persistent Trip Summary Floating Panel (shown in planning views) */}
      {(currentScreen === 'destination_select' || currentScreen === 'ai_recommend') && (
        <TripSummaryPanel
          constraints={constraints}
          destinations={selectedDestinations}
          feasibilityResult={sharedFeasibilityResult}
          routeLegsMap={routeLegsMap}
          onCheckPlan={() => setCurrentScreen('transport_select')}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">Smart City Explorer</span>
            <span>•</span>
            <span>Hackathon Project 2026</span>
          </div>

          <p className="text-slate-400 text-center sm:text-right">
            “AI recommends. Our system verifies.” — Built for realistic, constraint-aware exploration.
          </p>
        </div>
      </footer>

    </div>
  );
}
