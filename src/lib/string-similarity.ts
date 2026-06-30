export function getSimilarity(s1: string, s2: string): number {
    if (!s1 || !s2) return 0;
    const str1 = s1.toLowerCase().trim();
    const str2 = s2.toLowerCase().trim();
    
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) {
        // If one is fully contained in another, weight it highly (0.85 to 0.95 depending on length diff)
        const minLen = Math.min(str1.length, str2.length);
        const maxLen = Math.max(str1.length, str2.length);
        return 0.85 + (0.1 * (minLen / maxLen));
    }
    
    // Levenshtein distance
    const costs = [];
    for (let i = 0; i <= str1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= str2.length; j++) {
            if (i === 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (str1.charAt(i - 1) !== str2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[str2.length] = lastValue;
    }
    const maxLen = Math.max(str1.length, str2.length);
    const distance = costs[str2.length];
    return (maxLen - distance) / maxLen;
}
