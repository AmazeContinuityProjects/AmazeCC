import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MapPin, Phone, MessageCircle, BusFront } from 'lucide-react';
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
                <Card className="h-full flex flex-col overflow-hidden border-gray-200 dark:border-gray-800 midnight:border-gray-800 bg-white dark:bg-gray-900 midnight:bg-[#0a0a0a] shadow-sm hover:shadow-md transition-shadow">
                  <div className={`h-1.5 w-full ${bus.type === 'AC' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2 text-gray-900 dark:text-gray-100 midnight:text-gray-100">
                          <BusFront className={bus.type === 'AC' ? 'text-blue-500' : 'text-emerald-500'} />
                          {bus.route}
                        </CardTitle>
                        <span className={`inline-block px-2.5 py-1 mt-2.5 text-xs font-semibold rounded-full ${bus.type === 'AC' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 midnight:bg-blue-900/20 midnight:text-blue-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 midnight:bg-emerald-900/20 midnight:text-emerald-400'}`}>
                          {bus.type} Bus
                        </span>
                      </div>
                      {bus.busLocation && (
                        <div className="text-xs text-right bg-gray-50 dark:bg-gray-800/50 midnight:bg-gray-900/50 border border-gray-100 dark:border-gray-700 midnight:border-gray-800 px-2.5 py-1.5 rounded-lg shrink-0">
                          <span className="block font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Campus Location</span>
                          <span className="text-gray-800 dark:text-gray-200 midnight:text-gray-300 font-medium">{bus.busLocation}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col space-y-4">
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 midnight:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <MapPin size={14} /> Boarding Points
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-400 leading-relaxed">
                        {bus.boardingPoints.join(', ')}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800/60 mt-auto">
                      {bus.driverPhone ? (
                        <div className="flex items-center gap-2.5 text-sm">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/20 rounded-full shrink-0">
                            <Phone size={14} className="text-blue-600 dark:text-blue-400 midnight:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-200 midnight:text-gray-200">{bus.driverPhone}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-500">{bus.driverName || 'Driver'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 dark:text-gray-500 midnight:text-gray-600 italic flex items-center">
                          No driver contact available
                        </div>
                      )}

                      {bus.whatsappGroup && (
                        <a
                          href={bus.whatsappGroup}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1.5 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 hover:dark:bg-emerald-900/40 dark:text-emerald-400 midnight:bg-emerald-900/20 hover:midnight:bg-emerald-900/40 midnight:text-emerald-400 px-3 py-2 rounded-lg transition-colors border border-emerald-100 dark:border-emerald-900/50 midnight:border-emerald-900/50"
                        >
                          <MessageCircle size={16} />
                          Join Group
                        </a>
                      )}
                    </div>
                  </CardContent>
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
    </div>
  );
};

export default BusFinder;
