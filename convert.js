const fs = require('fs');

const apTheory = [
  ["Tuesday", "08:00", "08:50", "TFF1"], ["Wednesday", "08:00", "08:50", "TGG1"], ["Thursday", "08:00", "08:50", "TEE1"], ["Friday", "08:00", "08:50", "TCC1"], ["Saturday", "08:00", "08:50", "TDD1"],
  ["Tuesday", "09:00", "09:50", "A1"], ["Wednesday", "09:00", "09:50", "D1"], ["Thursday", "09:00", "09:50", "C1"], ["Friday", "09:00", "09:50", "TB1"], ["Saturday", "09:00", "09:50", "E1"],
  ["Tuesday", "10:00", "10:50", "B1"], ["Wednesday", "10:00", "10:50", "F1"], ["Thursday", "10:00", "10:50", "TG1"], ["Friday", "10:00", "10:50", "TA1"], ["Saturday", "10:00", "10:50", "C1"],
  ["Tuesday", "11:00", "11:50", "TC1"], ["Wednesday", "11:00", "11:50", "E1"], ["Thursday", "11:00", "11:50", "TAA1"], ["Friday", "11:00", "11:50", "F1"], ["Saturday", "11:00", "11:50", "TF1"],
  ["Tuesday", "12:00", "12:50", "G1"], ["Wednesday", "12:00", "12:50", "SC2"], ["Thursday", "12:00", "12:50", "ECS"], ["Friday", "12:00", "12:50", "TE1"], ["Saturday", "12:00", "12:50", "G1"],
  ["Tuesday", "13:00", "13:50", "D1"], ["Wednesday", "13:00", "13:50", "B1"], ["Thursday", "13:00", "13:50", "TBB1"], ["Friday", "13:00", "13:50", "SD2"], ["Saturday", "13:00", "13:50", "A1"],
  ["Tuesday", "14:00", "14:50", "F2"], ["Wednesday", "14:00", "14:50", "D2"], ["Thursday", "14:00", "14:50", "TE2"], ["Friday", "14:00", "14:50", "C2"], ["Saturday", "14:00", "14:50", "D2"],
  ["Tuesday", "15:00", "15:50", "A2"], ["Wednesday", "15:00", "15:50", "TF2"], ["Thursday", "15:00", "15:50", "SE1"], ["Friday", "15:00", "15:50", "TB2"], ["Saturday", "15:00", "15:50", "E2"],
  ["Tuesday", "16:00", "16:50", "B2"], ["Wednesday", "16:00", "16:50", "G2"], ["Thursday", "16:00", "16:50", "C2"], ["Friday", "16:00", "16:50", "TA2"], ["Saturday", "16:00", "16:50", "SD1"],
  ["Tuesday", "17:00", "17:50", "TC2"], ["Wednesday", "17:00", "17:50", "SC1"], ["Thursday", "17:00", "17:50", "A2"], ["Friday", "17:00", "17:50", "F2"], ["Saturday", "17:00", "17:50", "TAA2"],
  ["Tuesday", "18:00", "18:50", "G2"], ["Wednesday", "18:00", "18:50", "B2"], ["Thursday", "18:00", "18:50", "TD2"], ["Friday", "18:00", "18:50", "TEE2"], ["Saturday", "18:00", "18:50", "ECS"],
  ["Tuesday", "19:00", "19:50", "TDD2"], ["Wednesday", "19:00", "19:50", "TCC2"], ["Thursday", "19:00", "19:50", "TGG2"], ["Saturday", "19:00", "19:50", "TFF2"]
];

const apLab = [
  ["Tuesday", "08:00", "09:50", "L1+L2"], ["Tuesday", "10:00", "11:50", "L3+L4"], ["Tuesday", "12:00", "13:30", "L5+L6"], ["Tuesday", "14:00", "15:40", "L31+L32"], ["Tuesday", "16:00", "17:40", "L33+L34"], ["Tuesday", "18:00", "19:30", "L35+L36"],
  ["Wednesday", "08:00", "09:50", "L7+L8"], ["Wednesday", "10:00", "11:50", "L9+L10"], ["Wednesday", "12:00", "13:30", "L11+L12"], ["Wednesday", "14:00", "15:40", "L37+L38"], ["Wednesday", "16:00", "17:40", "L39+L40"], ["Wednesday", "18:00", "19:30", "L41+L42"],
  ["Thursday", "08:00", "09:50", "L13+L14"], ["Thursday", "10:00", "11:50", "L15+L16"], ["Thursday", "12:00", "13:30", "L17+L18"], ["Thursday", "14:00", "15:40", "L43+L44"], ["Thursday", "16:00", "17:40", "L45+L46"], ["Thursday", "18:00", "19:30", "L47+L48"],
  ["Friday", "08:00", "09:50", "L19+L20"], ["Friday", "10:00", "11:50", "L21+L22"], ["Friday", "12:00", "13:30", "L23+L24"], ["Friday", "14:00", "15:40", "L49+L50"], ["Friday", "16:00", "17:40", "L51+L52"], ["Friday", "18:00", "19:30", "L53+L54"],
  ["Saturday", "08:00", "09:50", "L25+L26"], ["Saturday", "10:00", "11:50", "L27+L28"], ["Saturday", "12:00", "13:30", "L29+L30"], ["Saturday", "14:00", "15:40", "L55+L56"], ["Saturday", "16:00", "17:40", "L57+L58"], ["Saturday", "18:00", "19:30", "L59+L60"]
];

function buildSchema(rows) {
  const map = new Map();
  rows.forEach(([day, start, end, label]) => {
    // start time to 12 hr
    const h = parseInt(start.split(':')[0]);
    const m = start.split(':')[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const startStr = `${h12}:${m} ${ampm}`;
    
    const eh = parseInt(end.split(':')[0]);
    const em = end.split(':')[1];
    const eampm = eh >= 12 ? 'PM' : 'AM';
    const eh12 = eh % 12 || 12;
    const endStr = `${eh12}:${em} ${eampm}`;
    
    const key = `${startStr}-${endStr}`;
    if (!map.has(key)) map.set(key, { start: startStr, end: endStr, days: {} });
    
    map.get(key).days[day.toLowerCase().substring(0,3)] = label;
  });
  return Array.from(map.values());
}

const apSchema = {
  theory: buildSchema(apTheory),
  lab: buildSchema(apLab)
};

fs.writeFileSync('src/app/data/ap.json', JSON.stringify(apSchema, null, 2));

const bhopalSlots = [
  ["Monday",    "A11", 0], ["Monday",    "B11", 1], ["Monday",    "C11", 2], ["Monday",    "A21", 3], ["Monday",    "A14", 4], ["Monday",    "B21", 5], ["Monday",    "C21", 6],
  ["Tuesday",   "D11", 0], ["Tuesday",   "E11", 1], ["Tuesday",   "F11", 2], ["Tuesday",   "D21", 3], ["Tuesday",   "E14", 4], ["Tuesday",   "E21", 5], ["Tuesday",   "F21", 6],
  ["Wednesday", "A12", 0], ["Wednesday", "B12", 1], ["Wednesday", "C12", 2], ["Wednesday", "A22", 3], ["Wednesday", "B14", 4], ["Wednesday", "B22", 5], ["Wednesday", "A24", 6],
  ["Thursday",  "D12", 0], ["Thursday",  "E12", 1], ["Thursday",  "F12", 2], ["Thursday",  "D22", 3], ["Thursday",  "F14", 4], ["Thursday",  "E22", 5], ["Thursday",  "F22", 6],
  ["Friday",    "A13", 0], ["Friday",    "B13", 1], ["Friday",    "C13", 2], ["Friday",    "A23", 3], ["Friday",    "C14", 4], ["Friday",    "B23", 5], ["Friday",    "B24", 6],
  ["Saturday",  "D13", 0], ["Saturday",  "E13", 1], ["Saturday",  "F13", 2], ["Saturday",  "D23", 3], ["Saturday",  "D14", 4], ["Saturday",  "D24", 5], ["Saturday",  "E23", 6]
];
const bhopalTimeBands = [
  ["08:30", "10:00"], ["10:05", "11:35"], ["11:40", "13:10"], ["13:15", "14:45"], ["14:50", "16:20"], ["16:25", "17:55"], ["18:00", "19:30"]
];
const bhopalTheory = bhopalSlots.map(([day, label, bandIdx]) => {
  return [day, bhopalTimeBands[bandIdx][0], bhopalTimeBands[bandIdx][1], label];
});

const bhopalSchema = {
  theory: buildSchema(bhopalTheory),
  lab: []
};
fs.writeFileSync('src/app/data/bhopal.json', JSON.stringify(bhopalSchema, null, 2));

console.log("Done");
