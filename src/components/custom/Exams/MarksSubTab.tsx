"use client";

import { useEffect, useState } from "react";
import NoContentFound from "../NoContentFound";
import MarksDisplay from "./MarksDisplay";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarksSubTab({ data, setActiveSubTab }) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 mb-6 px-4 md:px-0">
                <Button variant="ghost" size="icon" onClick={() => setActiveSubTab("overview")} className="rounded-full bg-white dark:bg-slate-800 midnight:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700 midnight:border-gray-800 hover:bg-gray-100">
                    <ChevronLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 leading-tight">
                        Current Sem Marks
                    </h1>
                </div>
            </div>
            <MarksDisplay data={data} />
        </div>
    );
}