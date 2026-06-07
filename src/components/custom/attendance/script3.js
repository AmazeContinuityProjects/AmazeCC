const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'CalendarView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /className=(["'`])([\s\S]*?)\1/g;

content = content.replace(regex, (match, quote, classNameStr) => {
    // skip if no dark class
    if (!classNameStr.includes('dark:')) return match;

    let tokens = classNameStr.split(/\s+/);
    let newTokens = [...tokens];

    tokens.forEach(token => {
        if (token.startsWith('dark:')) {
            let midToken = token.replace('dark:', 'midnight:');
            
            // Adjust specific colors for midnight
            if (midToken.includes('bg-gray-900') || midToken.includes('bg-slate-900')) {
                midToken = midToken.replace(/bg-(gray|slate)-900(\/.*)?/, 'bg-black$2');
            } else if (midToken.includes('bg-gray-800') || midToken.includes('bg-slate-800')) {
                midToken = midToken.replace(/bg-(gray|slate)-800(\/.*)?/, 'bg-gray-900$2');
            } else if (midToken.includes('border-gray-800') || midToken.includes('border-gray-700')) {
                midToken = midToken.replace(/border-(gray)-[78]00(\/.*)?/, 'border-gray-800$2');
            } else if (midToken.includes('text-gray-900') || midToken.includes('text-gray-800')) {
                midToken = midToken.replace(/text-(gray)-[89]00(\/.*)?/, 'text-white$2');
            } else if (midToken.includes('text-gray-700')) {
                midToken = midToken.replace(/text-(gray)-700(\/.*)?/, 'text-gray-300$2');
            }
            
            // Check if there is already a midnight variant with the same prefix
            // prefix is basically the property like text-, bg-, border-
            let matchPrefix = midToken.match(/^midnight:([a-z]+-)/);
            let prefix = matchPrefix ? matchPrefix[0] : null;

            if (prefix) {
                let hasPrefix = tokens.some(t => t.startsWith(prefix));
                if (!hasPrefix) {
                    newTokens.push(midToken);
                }
            } else {
                if (!tokens.includes(midToken)) {
                    newTokens.push(midToken);
                }
            }
        }
    });

    // Clean up spaces
    let newClassStr = newTokens.join(' ').trim();
    return `className=${quote}${newClassStr}${quote}`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added midnight classes successfully.');
