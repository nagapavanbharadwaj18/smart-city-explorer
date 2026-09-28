import React from 'react';
import { Bike, MapPin, Clock, Info, ShieldCheck } from 'lucide-react';
import { BIKE_RENTAL_OPTIONS } from '../data/mockData';

export const BikeRentalSection: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/50 rounded-3xl p-6 sm:p-8 border border-teal-200/80 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-teal-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              🚲 Bike rental options nearby
            </h3>
            <p className="text-xs text-slate-600">
              Potential local rental options in the vicinity of your starting anchor point.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-800 bg-teal-100/70 px-3 py-1 rounded-full self-start sm:self-auto border border-teal-200">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
          <span>Local Mobility Option</span>
        </div>
      </div>

      {/* Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BIKE_RENTAL_OPTIONS.map((hub) => (
          <div
            key={hub.id}
            className="bg-white rounded-2xl p-4 border border-teal-200/60 shadow-xs hover:border-teal-400 transition-colors space-y-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-700">{hub.distanceKm} km from start</span>
                <span className="text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  ₹{hub.hourlyRate}/hr
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 mt-1">{hub.name}</h4>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{hub.locationName}</span>
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
              {hub.contactNote}
            </p>

            <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Hours: {hub.operatingHours}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Compliance / Transparency Notice */}
      <div className="bg-white/80 p-3 rounded-xl border border-teal-100 text-[11px] text-slate-500 flex items-start gap-2">
        <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <span>
          <strong>Note:</strong> Rental rates are estimated standard tariffs. Smart City Explorer accounts for rental duration in your overall trip budget calculations based on planning estimates. (No real-time inventory tracking or booking capabilities).
        </span>
      </div>
    </div>
  );
};
