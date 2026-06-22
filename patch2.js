const fs = require('fs');
const targetFile = 'src/components/custom/Exams/FFCSTimetableTab.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. generateTimetables clash detection fix
const backtrackTarget = `      const backtrack = (courseIndex: number, currentCombo: ParsedCourse[], currentSlots: Set<string>) => {
        if (results.length >= MAX_RESULTS) return;
        if (courseIndex === targetCodes.length) {
          results.push([...currentCombo]);
          if (generatorUniqueFaculties) {
            currentCombo.forEach(c => usedFacultiesPerCourse.get(c.CODE)!.add(c.FACULTY));
          }
          return;
        }

        const options = optionsPerCourse[courseIndex];
        for (const opt of options) {
          if (generatorUniqueFaculties && usedFacultiesPerCourse.get(opt.CODE)!.has(opt.FACULTY)) {
            continue;
          }

          const slots = opt.SLOT.split('+').map(s => s.trim().toUpperCase());
          const hasConflict = slots.some(s => currentSlots.has(s));
          
          if (!hasConflict) {
            slots.forEach(s => currentSlots.add(s));
            currentCombo.push(opt);
            backtrack(courseIndex + 1, currentCombo, currentSlots);
            currentCombo.pop();
            slots.forEach(s => currentSlots.delete(s));
          }
        }
      };

      backtrack(0, [], new Set<string>());`;

const backtrackReplacement = `      type ParsedCourseWithPeriods = ParsedCourse & { periods: {day: string, startMin: number, endMin: number}[] };
      const optionsPerCourseWithPeriods: ParsedCourseWithPeriods[][] = optionsPerCourse.map(options => 
        options.map(opt => {
          const slots = opt.SLOT.split('+').map(s => s.trim().toUpperCase());
          return { ...opt, periods: slots.flatMap(getPeriodsForSlot) };
        })
      );

      const backtrack = (courseIndex: number, currentCombo: ParsedCourse[], currentPeriods: {day: string, startMin: number, endMin: number}[]) => {
        if (results.length >= MAX_RESULTS) return;
        if (courseIndex === targetCodes.length) {
          results.push([...currentCombo]);
          if (generatorUniqueFaculties) {
            currentCombo.forEach(c => usedFacultiesPerCourse.get(c.CODE)!.add(c.FACULTY));
          }
          return;
        }

        const options = optionsPerCourseWithPeriods[courseIndex];
        for (const opt of options) {
          if (generatorUniqueFaculties && usedFacultiesPerCourse.get(opt.CODE)!.has(opt.FACULTY)) {
            continue;
          }

          let hasConflict = false;
          for (const np of opt.periods) {
            for (const ep of currentPeriods) {
              if (np.day === ep.day && Math.max(np.startMin, ep.startMin) < Math.min(np.endMin, ep.endMin)) {
                hasConflict = true;
                break;
              }
            }
            if (hasConflict) break;
          }

          if (!hasConflict) {
            currentCombo.push(opt);
            backtrack(courseIndex + 1, currentCombo, currentPeriods.concat(opt.periods));
            currentCombo.pop();
          }
        }
      };

      backtrack(0, [], []);`;
content = content.replace(backtrackTarget, backtrackReplacement);


// 2. startDate / endDate fix
const exportCallTarget = `exportTimetableIcal(activeTimetable, getTimetableSchema(), startDate, endDate)`;
const exportCallReplacement = `exportTimetableIcal(activeTimetable, getTimetableSchema(), new Date(), new Date(new Date().setMonth(new Date().getMonth() + 4)))`;
content = content.replace(exportCallTarget, exportCallReplacement);


// 3. availableSlots fix
const availableSlotsTarget = `              const availableSlots = React.useMemo(() => {
                if (!selectedCourseCode) return [];
                const allRows = masterCourses.filter(c => c.CODE === selectedCourseCode);
                const addedTypes = activeTimetable.courses.filter(c => c.code === selectedCourseCode).map(c => c.type);
                return allRows.filter(r => !addedTypes.includes(r.TYPE.trim().toUpperCase()));
              }, [selectedCourseCode, activeTimetable, masterCourses]);`;
const availableSlotsReplacement = `              const availableSlots = React.useMemo(() => {
                if (!selectedCourseCode) return [];
                return masterCourses.filter(c => c.CODE === selectedCourseCode);
              }, [selectedCourseCode, masterCourses]);`;
content = content.replace(availableSlotsTarget, availableSlotsReplacement);

const mappedAvailableSlotsTarget = `              }).map(({ row, idx }) => {
                const slotsArray = row?.SLOT?.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL") || [];
                const clashError = checkClashes(slotsArray);
                const isBlocked = !!clashError;`;
const mappedAvailableSlotsReplacement = `              }).map(({ row, idx }) => {
                const slotsArray = row?.SLOT?.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL") || [];
                const clashError = checkClashes(slotsArray);
                const typeAdded = activeTimetable.courses.some(c => c.code === selectedCourseCode && c.type === row?.TYPE?.trim()?.toUpperCase());
                const isBlocked = !!clashError || typeAdded;`;
content = content.replace(mappedAvailableSlotsTarget, mappedAvailableSlotsReplacement);

const errorDisplayTarget = `                      {isBlocked && (
                        <div className="w-full">
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded uppercase block w-full whitespace-normal break-words leading-tight">
                            Clash: {clashError}
                          </span>
                        </div>
                      )}`;
const errorDisplayReplacement = `                      {isBlocked && (
                        <div className="w-full">
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded uppercase block w-full whitespace-normal break-words leading-tight">
                            {typeAdded ? \`\${row?.TYPE} Already Selected\` : \`Clash: \${clashError}\`}
                          </span>
                        </div>
                      )}`;
content = content.replace(errorDisplayTarget, errorDisplayReplacement);


// 4. Multiple variants UI - saveStagedTimetables update
const saveStagedTarget = `                        const selected = stagedTimetables.filter(t => selectedStagedIds.has(t.id));
                        setTimetables(prev => [...prev, ...selected]);
                        setActiveTimetableId(selected[0].id);`;
const saveStagedReplacement = `                        const selected: TimetableState[] = [];
                        stagedTimetables.forEach(t => {
                          if (t.variants && t.variants.length > 1) {
                            t.variants.forEach(v => {
                              if (selectedStagedIds.has(v.id)) selected.push(v);
                            });
                          } else if (selectedStagedIds.has(t.id)) {
                            selected.push(t);
                          }
                        });
                        setTimetables(prev => [...prev, ...selected]);
                        if (selected.length > 0) setActiveTimetableId(selected[0].id);`;
content = content.replace(saveStagedTarget, saveStagedReplacement);

// 4b. Multiple variants UI - Grid checkboxes
const gridSelectTarget = `                        {tt.variants && tt.variants.length > 1 && (
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
                                  Variant {i + 1} — {v.metrics?.buildingDashes || 0} dashes — {v.courses.map(c => c.faculty.split(' ')[0]).join(', ').substring(0, 30)}...
                                </option>
                              ))}
                            </select>
                          </div>
                        )}`;

const gridSelectReplacement = `                        {tt.variants && tt.variants.length > 1 && (
                          <div className="mt-auto pt-4 space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Preview Variant</label>
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
                                }
                              }}
                            >
                              {tt.variants.map((v, i) => (
                                <option key={v.id} value={v.id} className="bg-background text-foreground">
                                  Variant {i + 1} — {v.metrics?.buildingDashes || 0} dashes — {v.courses.map(c => c.faculty.split(' ')[0]).join(', ').substring(0, 30)}...
                                </option>
                              ))}
                            </select>

                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mt-2">Select Variants to Save</label>
                            <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                              {tt.variants.map((v, i) => (
                                <label key={v.id} className={\`flex items-center gap-1.5 text-xs px-2 py-1 rounded border cursor-pointer transition-colors \${selectedStagedIds.has(v.id) ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 font-medium' : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'}\`}>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={selectedStagedIds.has(v.id)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedStagedIds(prev => {
                                        const next = new Set(prev);
                                        if (checked) next.add(v.id);
                                        else next.delete(v.id);
                                        return next;
                                      });
                                    }}
                                  />
                                  V{i + 1}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}`;
content = content.replace(gridSelectTarget, gridSelectReplacement);

fs.writeFileSync(targetFile, content);
console.log('Successfully applied patch2.js!');
