import React from "react";
import { Link2, ExternalLink } from "lucide-react";
import quickLinks from "../../../data/quickLinks.json";

export default function UtilitiesTab() {
  return (
    <div className="w-full space-y-8 animate-fadeIn pb-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Link2 className="w-6 h-6 text-blue-500" /> Quick Links
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.importantLinks.map((link) => (
            <a
              key={link.id}
              href={link.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card border border-border hover:border-blue-500/50 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                  {link.title}
                </h3>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {link.desc}
              </p>
            </a>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
          Community Links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickLinks.communityLinks.map((link, idx) => (
            <a
              key={idx}
              href={link.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card border border-border hover:border-green-500/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-green-500 transition-colors" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground group-hover:text-green-400 transition-colors">
                  {link.title}
                </h3>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
