const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src/components/custom/Exams/FFCSTimetableTab.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add campus state
content = content.replace(
  'const [timetables, setTimetables] = useState<TimetableState[]>([]);',
  'const [timetables, setTimetables] = useState<TimetableState[]>([]);\n  const [campus, setCampus] = useState<string>("chennai");\n  useEffect(() => { GLOBAL_CAMPUS = campus; }, [campus]);'
);

// 2. Add Campus Selector UI in the toolbar
const toolbarTarget = '{/* Desktop Toolbar */}';
const campusSelector = `
            <div className="flex items-center gap-2 border-r border-border pr-2">
              <MapIcon className="w-4 h-4 text-muted-foreground" />
              <select
                className="bg-transparent text-sm text-foreground focus:outline-none focus:ring-0 cursor-pointer"
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
              >
                <option value="chennai">Chennai Campus</option>
                <option value="ap">AP Campus</option>
                <option value="bhopal">Bhopal Campus</option>
              </select>
            </div>
`;
content = content.replace(toolbarTarget, toolbarTarget + '\n' + campusSelector);

// 3. Add to mobile toolbar as well
const mobileToolbarTarget = '<div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">';
const mobileCampusSelector = `
              <div className="flex items-center gap-2 border-r border-border pr-2 mr-1 shrink-0">
                <MapIcon className="w-4 h-4 text-muted-foreground" />
                <select
                  className="bg-transparent text-sm text-foreground focus:outline-none focus:ring-0 cursor-pointer"
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                >
                  <option value="chennai">Chennai</option>
                  <option value="ap">AP</option>
                  <option value="bhopal">Bhopal</option>
                </select>
              </div>
`;
content = content.replace(mobileToolbarTarget, mobileToolbarTarget + '\n' + mobileCampusSelector);

// 4. Balanced grouping logic
const groupingTarget = `        newTts.forEach((t, i) => { t.name = \`Option \${i + 1}\`; });

        setStagedTimetables(newTts);
        setSuccessMsg(\`Found \${newTts.length} valid timetables. Review them below!\`);`;

const groupedLogic = `        // Group by slot signature
        const grouped = new Map<string, TimetableState[]>();
        newTts.forEach(tt => {
          const sig = tt.courses.map(c => \`\${c.code}:\${[...c.slots].sort().join(',')}\`).sort().join('|');
          if (!grouped.has(sig)) grouped.set(sig, []);
          grouped.get(sig)!.push(tt);
        });

        const consolidatedTts: TimetableState[] = [];
        grouped.forEach((group) => {
          if (group.length > 1) {
            group.forEach(g => g.variants = group); // Give all variants the full group list
          }
          consolidatedTts.push(group[0]);
        });

        consolidatedTts.forEach((t, i) => { t.name = \`Option \${i + 1}\`; });

        setStagedTimetables(consolidatedTts);
        setSuccessMsg(\`Found \${consolidatedTts.length} unique timetable layouts (with \${newTts.length - consolidatedTts.length} variants). Review them below!\`);`;

content = content.replace(groupingTarget, groupedLogic);

// 5. Block Dashes metric
const oldBalanced = `          // Social Score: 0-100% -> score * 1
          const aBalanced = (am.halfDays * 10) + ((20 - am.gaps) * 5) + (am.socialScore);
          const bBalanced = (bm.halfDays * 10) + ((20 - bm.gaps) * 5) + (bm.socialScore);
          return bBalanced - aBalanced;`;

const newBalanced = `          // Block Dashes: penalty of 5 points per dash
          // Social Score: 0-100% -> score * 1
          const aBalanced = (am.halfDays * 10) + ((20 - am.gaps) * 5) - ((am.buildingDashes || 0) * 5) + (am.socialScore);
          const bBalanced = (bm.halfDays * 10) + ((20 - bm.gaps) * 5) - ((bm.buildingDashes || 0) * 5) + (bm.socialScore);
          return bBalanced - aBalanced;`;

content = content.replace(oldBalanced, newBalanced);

// 6. Variant selector in Preview
const previewTarget = `                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">`;

const previewSelector = `                </div>

                {generatorPreviewTimetable.variants && generatorPreviewTimetable.variants.length > 1 && (
                  <div className="bg-background rounded-2xl border border-border p-4 shadow-sm mb-4">
                    <div className="text-sm font-bold text-foreground mb-2">
                      Faculty / Venue Variants for this layout ({generatorPreviewTimetable.variants.length})
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {generatorPreviewTimetable.variants.map((v, idx) => (
                        <button
                          key={v.id}
                          onClick={() => setGeneratorPreviewTimetable(v)}
                          className={\`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors border \${
                            generatorPreviewTimetable.id === v.id
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-600'
                              : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
                          }\`}
                        >
                          Variant {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">`;

content = content.replace(previewTarget, previewSelector);

// 7. Variant selector in Grid
const gridTarget = `                        {generatorMaximizeFreeTimeFriends.length > 0 && (
                          <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 mt-auto">
                            <div className="text-xs font-bold text-pink-500 mb-1 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" /> Social Score: {tt.metrics?.socialScore}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate" title={tt.metrics?.bestFriendMatches.join(', ')}>
                              Matches best with: <span className="font-medium text-foreground">{tt.metrics?.bestFriendMatches.join(', ') || 'None'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>`;

const gridSelector = `                        {generatorMaximizeFreeTimeFriends.length > 0 && (
                          <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 mt-3">
                            <div className="text-xs font-bold text-pink-500 mb-1 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" /> Social Score: {tt.metrics?.socialScore}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate" title={tt.metrics?.bestFriendMatches.join(', ')}>
                              Matches best with: <span className="font-medium text-foreground">{tt.metrics?.bestFriendMatches.join(', ') || 'None'}</span>
                            </div>
                          </div>
                        )}

                        {tt.variants && tt.variants.length > 1 && (
                          <div className="mt-auto pt-4">
                            <select 
                              className="w-full bg-muted/50 hover:bg-muted border border-border rounded-xl text-xs font-medium p-2 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-colors cursor-pointer"
                              onClick={e => e.stopPropagation()}
                              value={tt.id}
                              onChange={e => {
                                e.stopPropagation();
                                const newVariantId = e.target.value;
                                const selectedVariant = tt.variants!.find(v => v.id === newVariantId);
                                if (selectedVariant) {
                                  setStagedTimetables(prev => prev.map(t => {
                                    if (t.id === tt.id) {
                                      return { ...selectedVariant, variants: tt.variants, name: tt.name };
                                    }
                                    return t;
                                  }));
                                  
                                  setSelectedStagedIds(prev => {
                                    if (prev.has(tt.id)) {
                                      const next = new Set(prev);
                                      next.delete(tt.id);
                                      next.add(newVariantId);
                                      return next;
                                    }
                                    return prev;
                                  });
                                }
                              }}
                            >
                              {tt.variants.map((v, i) => (
                                <option key={v.id} value={v.id} className="bg-background text-foreground">
                                  Variant {i + 1} • {v.metrics?.buildingDashes || 0} dashes • {v.courses.map(c => c.faculty.split(' ')[0]).join(', ').substring(0, 30)}...
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>`;

content = content.replace(gridTarget, gridSelector);


// 8. Add export to iCal button back
const exportTarget = `<button title="Duplicate Timetable" onClick={duplicateTimetable} className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"><Copy className="w-4 h-4" /></button>`;
const exportButton = `<button title="Export to Calendar (iCal)" onClick={() => exportTimetableIcal(activeTimetable, getTimetableSchema(), startDate, endDate)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"><Download className="w-4 h-4" /></button>`;

content = content.replace(exportTarget, exportTarget + '\\n                    ' + exportButton);

// 9. Add exportTimetableIcal import back
const importExport = `import { isCourseFullyAdded } from "./FFCS/utils";`;
content = content.replace(importExport, importExport + '\\nimport { exportTimetableIcal } from "@/lib/exportIcal";');


fs.writeFileSync(targetFile, content);
console.log('Successfully patched FFCSTimetableTab.tsx!');
