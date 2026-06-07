import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MapPin, Phone, MessageCircle, BusFront, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface BusFinderProps {
  buses: BusRoute[];
}

const BusFinder: React.FC<BusFinderProps> = ({ buses }) => {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          VIT Bus Finder
        </h1>
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-xl leading-5 bg-white dark:bg-gray-800/50 midnight:bg-gray-900/50 text-gray-900 dark:text-gray-100 midnight:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-sm backdrop-blur-sm"
            placeholder="Search boarding point or route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

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
                  className="cursor-pointer relative h-full flex flex-col overflow-hidden bg-white/20 dark:bg-gray-900/40 midnight:bg-white/[0.03] border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] midnight:shadow-[0_8px_30px_rgba(255,255,255,0.02)] backdrop-blur-xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl opacity-20 dark:opacity-10 midnight:opacity-15 pointer-events-none ${bus.type === 'AC' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  
                  <CardHeader className="px-4 py-3 relative z-10 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-xl bg-white/50 dark:bg-gray-800/50 midnight:bg-white/5 shadow-sm border border-white/20 dark:border-white/5 midnight:border-white/10 ${bus.type === 'AC' ? 'text-blue-600 dark:text-blue-400 midnight:text-blue-400' : 'text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400'}`}>
                         <BusFront size={20} />
                       </div>
                       <div className="flex flex-col">
                         <CardTitle className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 midnight:from-white midnight:to-gray-300 leading-tight">
                           {bus.route}
                         </CardTitle>
                         <span className={`inline-flex px-1.5 py-0.5 mt-0.5 w-fit text-[9px] uppercase tracking-widest font-bold rounded border shadow-sm ${bus.type === 'AC' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 midnight:bg-blue-500/20 midnight:text-blue-300 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 midnight:bg-emerald-500/20 midnight:text-emerald-300 border-emerald-500/20'}`}>
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
              className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900/50 p-4 rounded-full mb-4">
                <Search className="w-8 h-8 text-gray-400 dark:text-gray-500 midnight:text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-200 mb-1">No buses found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500">
                We couldn't find any buses matching "{searchQuery}". Try a different boarding point or route.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedBus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
            onClick={() => setSelectedBus(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card className="relative overflow-hidden bg-white/90 dark:bg-gray-900/90 midnight:bg-[#0a0a0a]/90 border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl">
                <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl opacity-20 dark:opacity-10 midnight:opacity-15 pointer-events-none ${selectedBus.type === 'AC' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                
                <CardHeader className="pb-4 relative z-10 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                       <div className={`p-3 rounded-2xl bg-white/50 dark:bg-gray-800/50 midnight:bg-white/5 shadow-sm border border-white/20 dark:border-white/5 midnight:border-white/10 ${selectedBus.type === 'AC' ? 'text-blue-600 dark:text-blue-400 midnight:text-blue-400' : 'text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400'}`}>
                         <BusFront size={28} />
                       </div>
                       <div>
                         <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 midnight:from-white midnight:to-gray-300">
                           {selectedBus.route}
                         </CardTitle>
                         <div className="flex items-center gap-2 mt-1">
                           <span className={`inline-flex px-3 py-0.5 text-[10px] uppercase tracking-widest font-bold rounded-md border shadow-sm ${selectedBus.type === 'AC' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 midnight:bg-blue-500/20 midnight:text-blue-300 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 midnight:bg-emerald-500/20 midnight:text-emerald-300 border-emerald-500/20'}`}>
                             {selectedBus.type} Bus
                           </span>
                           {selectedBus.busLocation && (
                             <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 midnight:text-gray-400 bg-black/5 dark:bg-white/5 midnight:bg-white/5 px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5 midnight:border-white/5">
                               {selectedBus.busLocation}
                             </span>
                           )}
                         </div>
                       </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedBus(null)} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 midnight:bg-white/5 midnight:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400">
                    <X size={20} />
                  </button>
                </CardHeader>

                <CardContent className="space-y-6 relative z-10 pt-2">
                  <div className="bg-white/40 dark:bg-black/30 midnight:bg-white/5 rounded-2xl p-5 border border-white/50 dark:border-white/5 midnight:border-white/10 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 midnight:text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MapPin size={16} className="text-gray-400 midnight:text-gray-300" /> Route Path
                    </h4>
                    <div className="flex flex-col gap-2">
                      {selectedBus.boardingPoints.map((bp, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 midnight:bg-gray-600" />
                            {i !== selectedBus.boardingPoints.length - 1 && <div className="w-0.5 h-4 bg-gray-200 dark:bg-gray-700 midnight:bg-gray-800 my-0.5" />}
                          </div>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-100">{bp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/40 dark:bg-black/30 midnight:bg-white/5 rounded-2xl p-5 border border-white/50 dark:border-white/5 midnight:border-white/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    {selectedBus.driverPhone ? (
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/80 dark:bg-gray-800/80 midnight:bg-white/10 shadow-sm border border-white/50 dark:border-white/5 midnight:border-white/10 rounded-full shrink-0">
                          <Phone size={18} className="text-gray-700 dark:text-gray-300 midnight:text-gray-200" />
                        </div>
                        <div>
                          <p className="text-base font-bold text-gray-900 dark:text-white midnight:text-white tracking-wide">{selectedBus.driverPhone}</p>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider mt-0.5">{selectedBus.driverName || 'Driver'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 midnight:text-gray-400 font-medium italic">
                        No driver contact available
                      </div>
                    )}

                    {selectedBus.whatsappGroup && (
                      <a
                        href={selectedBus.whatsappGroup}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold bg-[#25D366]/10 hover:bg-[#25D366]/20 midnight:bg-[#25D366]/15 midnight:hover:bg-[#25D366]/25 text-[#25D366] px-5 py-3 rounded-xl transition-all border border-[#25D366]/20 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                      >
                        <MessageCircle size={18} />
                        Join Group
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusFinder;
