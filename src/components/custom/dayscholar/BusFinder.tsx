import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from "@amazecontinuityprojects/amazeui";
import { Search, MapPin, Phone, MessageCircle, ChevronRight, User, Clock, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from "../shared/Modal";
import SearchInput from "../shared/SearchInput";
import EmptyState from "../shared/EmptyState";
import TransportRegistration from "./TransportRegistration";
import type { BusRoute, TransportData } from '@/types/transport';

interface BusFinderProps {
  buses: BusRoute[];
  transportData?: TransportData | null;
  transportLoading?: boolean;
  loginToVTOP?: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
}

const BusFinder: React.FC<BusFinderProps> = ({ buses, transportData, transportLoading, loginToVTOP }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBus, setSelectedBus] = useState<BusRoute | null>(null);

  const filteredBuses = buses.filter((bus) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bus.route.toLowerCase().includes(query) ||
      bus.boardingPoints.some((point) => point.toLowerCase().includes(query)) ||
      (bus.driverName || '').toLowerCase().includes(query) ||
      (bus.driverPhone || '').includes(query)
    );
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900  dark:text-gray-100">
          Dayscholar Bus Hub
        </h1>
        <SearchInput placeholder="Search route, stop, driver..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} containerClassName="w-full md:w-80" />
      </div>

      <TransportRegistration data={transportData ?? null} loading={transportLoading ?? false} loginToVTOP={loginToVTOP ?? (async () => ({ cookies: [], authorizedID: "", csrf: "" }))} buses={buses} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredBuses.length > 0 ? (
            filteredBuses.map((bus, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                key={`${bus.id}-${index}`}
              >
                <Card
                  onClick={() => setSelectedBus(bus)}
                  className="cursor-pointer relative h-full flex flex-col solid-card hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl opacity-20  dark:opacity-15 pointer-events-none ${bus.type === 'AC' ? 'bg-blue-500' : 'bg-emerald-500'}`} />

                  <CardHeader className="px-4 py-3 relative z-10 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-xl bg-white/50  dark:bg-white/5 shadow-sm border border-white/20  dark:border-white/10 ${bus.type === 'AC' ? 'bg-blue-500/10 text-blue-700  dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-700  dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/20'} font-black text-sm leading-none`}>
                         #{bus.id}
                       </div>
                       <div className="flex flex-col">
                         <CardTitle className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-500   dark:from-white dark:to-gray-300 leading-tight">
                           {bus.route}
                         </CardTitle>
                         <div className="flex items-center gap-2 mt-1">
                           <span className={`inline-flex px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold rounded border shadow-sm ${bus.type === 'AC' ? 'bg-blue-500/10 text-blue-700  dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-700  dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/20'}`}>
                             {bus.type}
                           </span>
                           <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                             <MapPin size={10} />
                             {bus.stops?.length || bus.boardingPoints.length} stops
                           </span>
                         </div>
                       </div>
                    </div>

                    <ChevronRight size={20} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  </CardHeader>


                </Card>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-1 md:col-span-2"
            >
              <EmptyState
                icon={<Search className="w-8 h-8" />}
                title="No buses found"
                description={`We couldn't find any buses matching "${searchQuery}". Try a different route, stop, or driver name.`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedBus && (
        <BusDetailModal bus={selectedBus} onClose={() => setSelectedBus(null)} />
      )}
    </div>
  );
};

function BusDetailModal({ bus, onClose }: { bus: BusRoute; onClose: () => void }) {
  const stops = (bus.stops || []).sort((a, b) => a.stopOrder - b.stopOrder);
  const placements = bus.placements || [];
  const firstStops = stops.slice(0, 5);

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl opacity-20 dark:opacity-15 pointer-events-none ${bus.type === 'AC' ? 'bg-blue-500' : 'bg-emerald-500'}`} />

      {/* Route header bar */}
      <div className="flex items-center gap-3 pb-5 border-b border-white/50 dark:border-white/10">
        <div className={`p-3 rounded-2xl bg-white/50 dark:bg-white/5 shadow-sm border border-white/20 dark:border-white/10 font-black text-xl leading-none ${
          bus.type === 'AC'
            ? 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20'
            : 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/20'
        }`}>
          #{bus.id}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{bus.route}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] uppercase tracking-widest font-bold ${
              bus.type === 'AC' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {bus.type} Bus
            </span>
            {bus.busLocation && (
              <>
                <span className="text-[11px] text-gray-300 dark:text-gray-600">|</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{bus.busLocation}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        {/* Contacts */}
        <div className="space-y-2">
          {(bus.driverName || bus.driverPhone) && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0">
                  <Phone size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Driver</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{bus.driverName || 'Driver'}</p>
                </div>
              </div>
              {bus.driverPhone && (
                <a href={`tel:${bus.driverPhone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-xs font-bold shrink-0">
                  <Phone size={12} /> Call
                </a>
              )}
            </div>
          )}

          {(bus.supervisorName || bus.supervisorPhone) && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0">
                  <Shield size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supervisor</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{bus.supervisorName || 'Supervisor'}</p>
                </div>
              </div>
              {bus.supervisorPhone && (
                <a href={`tel:${bus.supervisorPhone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-xs font-bold shrink-0">
                  <Phone size={12} /> Call
                </a>
              )}
            </div>
          )}

          {(bus.driverInchargeName || bus.driverInchargePhone) && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <Phone size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Driver Incharge</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{bus.driverInchargeName || 'Incharge'}</p>
                </div>
              </div>
              {bus.driverInchargePhone && (
                <a href={`tel:${bus.driverInchargePhone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-xs font-bold shrink-0">
                  <Phone size={12} /> Call
                </a>
              )}
            </div>
          )}
        </div>

        {/* Stops — Timeline */}
        {firstStops.length > 0 && (
          <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-4 border border-white/50 dark:border-white/10">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1">
              <Clock size={12} /> Stops & Pickup Times
            </p>
            <div className="relative">
              {firstStops.map((s, i) => (
                <div key={i} className="flex items-start gap-3 pb-1 last:pb-0">
                  <div className="shrink-0 w-12 text-right">
                    {s.pickupTime && (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-3">{s.pickupTime}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-[3px] ${i === 0 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    {i !== firstStops.length - 1 && <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />}
                  </div>
                  <div className="pb-3 last:pb-0 min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-5">{s.stopName}</span>
                  </div>
                </div>
              ))}
            </div>
            {stops.length > 5 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 ml-[4.5rem]">+{stops.length - 5} more stops</p>
            )}
          </div>
        )}

        {/* Fallback to plain boardingPoints */}
        {firstStops.length === 0 && bus.boardingPoints.length > 0 && (
          <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-4 border border-white/50 dark:border-white/10">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
              <MapPin size={12} /> Route Path
            </p>
            <div className="space-y-1">
              {bus.boardingPoints.map((bp, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                    {i !== bus.boardingPoints.length - 1 && <div className="w-px h-3 bg-gray-200 dark:bg-gray-800 my-0.5" />}
                  </div>
                  <span className="text-gray-800 dark:text-gray-200">{bp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Placements */}
        {placements.map((p, i) => (
          <div key={i} className="flex items-center gap-4 bg-white/60 dark:bg-white/5 rounded-xl p-3.5 border border-white/50 dark:border-white/10">
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none">{p.dispersalTime}</span>
              <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5">dispersal</span>
            </div>
            <div className="w-px h-10 bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.zone}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Placement Zone</p>
            </div>
          </div>
        ))}

        {/* WhatsApp */}
        {bus.whatsappGroup && (
          <a
            href={bus.whatsappGroup}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 text-sm font-bold bg-[#25D366]/10 hover:bg-[#25D366]/20 dark:bg-[#25D366]/15 dark:hover:bg-[#25D366]/25 text-[#25D366] rounded-xl transition-all border border-[#25D366]/20 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <MessageCircle size={18} />
            Join WhatsApp Group
          </a>
        )}
      </div>
    </Modal>
  );
}

export default BusFinder;
