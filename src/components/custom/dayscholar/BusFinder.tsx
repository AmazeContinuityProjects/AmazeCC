import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from "@amazecontinuityprojects/amazeui";
import { Search, MapPin, Phone, MessageCircle, BusFront, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from "../shared/Modal";
import SearchInput from "../shared/SearchInput";
import EmptyState from "../shared/EmptyState";
import TransportRegistration from "./TransportRegistration";

interface BusRoute {
  id: string;
  type: string;
  route: string;
  boardingPoints: string[];
  driverPhone: string;
  driverName: string;
  whatsappGroup: string;
  busLocation: string;
}

interface TransportData {
  hasRegistration: boolean;
  registerNumber?: string;
  name?: string;
  programme?: string;
  branch?: string;
  routeSelected?: string;
  fpReference?: string;
  paymentStatus?: string;
  busRouteId?: string;
  qrCode?: string;
  pageCsrf?: string;
}

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
      bus.boardingPoints.some((point) => point.toLowerCase().includes(query))
    );
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900  dark:text-gray-100">
          Dayscholar Bus Hub
        </h1>
        <SearchInput placeholder="Search boarding point or route..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} containerClassName="w-full md:w-80" />
      </div>

      <TransportRegistration data={transportData ?? null} loading={transportLoading ?? false} loginToVTOP={loginToVTOP ?? (async () => ({ cookies: [], authorizedID: "", csrf: "" }))} />

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
                key={bus.id}
              >
                <Card 
                  onClick={() => setSelectedBus(bus)}
                  className="cursor-pointer relative h-full flex flex-col solid-card hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl opacity-20  dark:opacity-15 pointer-events-none ${bus.type === 'AC' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  
                  <CardHeader className="px-4 py-3 relative z-10 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-xl bg-white/50  dark:bg-white/5 shadow-sm border border-white/20  dark:border-white/10 ${bus.type === 'AC' ? 'text-blue-600  dark:text-blue-400' : 'text-emerald-600  dark:text-emerald-400'}`}>
                         <BusFront size={20} />
                       </div>
                       <div className="flex flex-col">
                         <CardTitle className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-500   dark:from-white dark:to-gray-300 leading-tight">
                           {bus.route}
                         </CardTitle>
                         <span className={`inline-flex px-1.5 py-0.5 mt-0.5 w-fit text-[9px] uppercase tracking-widest font-bold rounded border shadow-sm ${bus.type === 'AC' ? 'bg-blue-500/10 text-blue-700  dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-700  dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/20'}`}>
                           {bus.type} Bus
                         </span>
                       </div>
                    </div>
                    
                    <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
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
                description={`We couldn't find any buses matching "${searchQuery}". Try a different boarding point or route.`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedBus && (
        <Modal onClose={() => setSelectedBus(null)} maxWidth="max-w-lg">
          <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl opacity-20  dark:opacity-15 pointer-events-none ${selectedBus.type === 'AC' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
          
          <div className="flex flex-row items-start justify-between pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                 <div className={`p-3 rounded-2xl bg-white/50  dark:bg-white/5 shadow-sm border border-white/20  dark:border-white/10 ${selectedBus.type === 'AC' ? 'text-blue-600  dark:text-blue-400' : 'text-emerald-600  dark:text-emerald-400'}`}>
                   <BusFront size={28} />
                 </div>
                 <div>
                   <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-500   dark:from-white dark:to-gray-300">
                     {selectedBus.route}
                   </h2>
                   <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex px-3 py-0.5 text-[10px] uppercase tracking-widest font-bold rounded-md border shadow-sm ${selectedBus.type === 'AC' ? 'bg-blue-500/10 text-blue-700  dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-700  dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/20'}`}>
                       {selectedBus.type} Bus
                     </span>
                     {selectedBus.busLocation && (
                       <span className="text-[10px] font-semibold text-gray-600  dark:text-gray-400 bg-black/5  dark:bg-white/5 px-2 py-0.5 rounded-md border border-black/5  dark:border-white/5">
                         {selectedBus.busLocation}
                       </span>
                     )}
                   </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-2">
            <div className="solid-card p-5">
              <h4 className="text-xs font-bold text-gray-500  dark:text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MapPin size={16} className="text-gray-400 dark:text-gray-300" /> Route Path
              </h4>
              <div className="flex flex-col gap-2">
                {selectedBus.boardingPoints.map((bp, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-gray-300  dark:bg-gray-600" />
                      {i !== selectedBus.boardingPoints.length - 1 && <div className="w-0.5 h-4 bg-gray-200  dark:bg-gray-800 my-0.5" />}
                    </div>
                    <span className="text-sm font-medium text-gray-800  dark:text-gray-100">{bp}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="solid-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              {selectedBus.driverPhone ? (
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/80  dark:bg-white/10 shadow-sm border border-white/50  dark:border-white/10 rounded-full shrink-0">
                    <Phone size={18} className="text-gray-700  dark:text-gray-200" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900  dark:text-white tracking-wide">{selectedBus.driverPhone}</p>
                    <p className="text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mt-0.5">{selectedBus.driverName || 'Driver'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400 dark:text-gray-400 font-medium italic">
                  No driver contact available
                </div>
              )}

              {selectedBus.whatsappGroup && (
                <a
                  href={selectedBus.whatsappGroup}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold bg-[#25D366]/10 hover:bg-[#25D366]/20 dark:bg-[#25D366]/15 dark:hover:bg-[#25D366]/25 text-[#25D366] px-5 py-3 rounded-xl transition-all border border-[#25D366]/20 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <MessageCircle size={18} />
                  Join Group
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BusFinder;
