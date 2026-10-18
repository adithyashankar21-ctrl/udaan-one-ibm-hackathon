import React, { useState } from 'react';
import { 
  MapPin, 
  Building2, 
  Award, 
  TrendingUp, 
  Users, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Layers,
  Sparkles
} from 'lucide-react';
import { DISTRICT_CLUSTERS } from '../data/districts';
import { BeneficiaryProfile, DistrictCluster } from '../types';

interface DistrictExplorerProps {
  userProfile: BeneficiaryProfile;
  onSelectDistrict: (district: string, state: string) => void;
  onGenerateRoadmap: () => void;
}

export const DistrictExplorer: React.FC<DistrictExplorerProps> = ({
  userProfile,
  onSelectDistrict,
  onGenerateRoadmap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string>('All');

  const states = ['All', ...Array.from(new Set(DISTRICT_CLUSTERS.map((d) => d.state)))];

  const filteredDistricts = DISTRICT_CLUSTERS.filter((d) => {
    const matchesState = selectedState === 'All' || d.state === selectedState;
    const matchesSearch =
      d.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.traditionalCrafts.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
      d.growingIndustries.some((ind) => ind.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesState && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
        These district profiles are illustrative summaries of traditional crafts and growing industries, for exploring ideas. They are not official
        listings of training centres or schemes — confirm with your District Industries Centre, District Social Welfare Office or Skill India.
      </p>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 rounded-3xl border border-amber-500/20 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold text-xs border border-amber-400/30">
                Local Economic Mapping
              </span>
              <span className="text-slate-400 text-xs">
                Connecting SC Traditional Artisans with Regional Market Demand
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">
              जिला स्तरीय आर्थिक क्लस्टर एवं आजीविका मैपिंग (District Clusters)
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Under PM-AJAY GIA, skilling programs are specifically aligned with district-specific industrial hubs, GI-tagged artisan clusters, and local supply chains.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-700/80 p-3.5 rounded-2xl text-xs">
            <span className="text-slate-400 block">Your Current Profile District:</span>
            <span className="font-bold text-amber-300 text-sm">
              {userProfile.district}, {userProfile.state}
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search district, trade (e.g. Leather, Handloom, Solar, Knitwear)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {states.map((st) => (
              <button
                key={st}
                onClick={() => setSelectedState(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedState === st
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* District Cluster Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDistricts.map((item, idx) => {
          const isCurrentSelected =
            userProfile.district.toLowerCase() === item.district.toLowerCase();

          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between p-5 shadow-xl ${
                isCurrentSelected
                  ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/30'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <h3 className="font-black text-lg text-white">{item.district}</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-medium ml-5.5">{item.state}</span>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ~{item.scPopulationPercent}% SC population
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1 text-right">Census-based estimate</span>
                  </div>
                </div>

                {/* Traditional SC Crafts */}
                <div className="mt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    पारंपरिक शिल्प व चर्म/हस्तकला (Traditional Crafts):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.traditionalCrafts.map((craft, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-2 py-1 rounded-md text-[11px] bg-slate-800 text-amber-200 border border-slate-700"
                      >
                        {craft}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Emerging Local Industries */}
                <div className="mt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>उभरते उद्योग एवं मांग (Growing Market Demand):</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.growingIndustries.map((ind, iIdx) => (
                      <span
                        key={iIdx}
                        className="px-2 py-1 rounded-md text-[11px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-medium"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>

                {/* District Scheme Highlight */}
                <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <strong className="text-amber-400 block mb-0.5">Opportunity idea:</strong>
                  {item.highlightScheme}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                {isCurrentSelected ? (
                  <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selected for Profile</span>
                  </span>
                ) : (
                  <button
                    onClick={() => onSelectDistrict(item.district, item.state)}
                    className="text-xs font-bold text-slate-300 hover:text-amber-300 transition"
                  >
                    Select District for Livelihood Mapping →
                  </button>
                )}

                <button
                  onClick={() => {
                    onSelectDistrict(item.district, item.state);
                    onGenerateRoadmap();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow transition"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Map NSQF</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
