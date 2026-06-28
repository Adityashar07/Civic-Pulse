/**
 * AI Engine for Community Hero
 * Handles: Auto-categorization, duplicate detection, hotspot analysis, and forecasting.
 */

// Helper: Haversine distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Helper: Jaccard Word Similarity
function getJaccardSimilarity(str1, str2) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with']);
  
  const getWords = (str) => {
    return new Set(
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
    );
  };

  const setA = getWords(str1);
  const setB = getWords(str2);

  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Categorize issue based on keyword matching
 */
function autoCategorize(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
  const categoryKeywords = {
    pothole: ['pothole', 'crater', 'road', 'asphalt', 'bump', 'driveway', 'street damage', 'pavement'],
    water_leak: ['water', 'leak', 'pipe', 'burst', 'drain', 'sewage', 'flooding', 'overflow', 'clogged drain'],
    streetlight: ['light', 'streetlight', 'dark', 'lamp', 'bulb', 'illumination', 'blackout', 'no light'],
    waste_management: ['garbage', 'trash', 'waste', 'dump', 'rubbish', 'litter', 'bin', 'debris', 'overflowing bin'],
    infrastructure: ['bridge', 'sidewalk', 'bench', 'park', 'fence', 'rail', 'sign', 'signal', 'playground']
  };

  let bestCategory = 'other';
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let matches = 0;
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        matches++;
      }
    });
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category;
    }
  }

  // Determine Severity
  let severity = 'low';
  const highKeywords = ['danger', 'hazardous', 'safety', 'risk', 'accident', 'injury', 'burst', 'flood', 'fire', 'toxic', 'blocking', 'blocked', 'collapse'];
  const mediumKeywords = ['broken', 'clogged', 'slow', 'leaking', 'smelly', 'damaged', 'darkness', 'holes', 'filthy'];

  const containsHigh = highKeywords.some(keyword => text.includes(keyword));
  const containsMedium = mediumKeywords.some(keyword => text.includes(keyword));

  if (containsHigh) {
    severity = 'high';
  } else if (containsMedium) {
    severity = 'medium';
  }

  return { category: bestCategory, severity };
}

/**
 * Check if the new issue is a duplicate of an existing one
 */
function detectDuplicate(newIssue, existingIssues) {
  const DUPLICATE_DISTANCE_LIMIT = 100; // meters
  const DUPLICATE_SIMILARITY_LIMIT = 0.20; // Jaccard similarity

  for (const issue of existingIssues) {
    // Check if the issue is unresolved
    if (['reported', 'verified', 'in_progress'].includes(issue.status)) {
      const distance = getDistance(
        newIssue.latitude,
        newIssue.longitude,
        issue.latitude,
        issue.longitude
      );

      if (distance <= DUPLICATE_DISTANCE_LIMIT) {
        const similarity = getJaccardSimilarity(
          `${newIssue.title} ${newIssue.description}`,
          `${issue.title} ${issue.description}`
        );

        if (similarity >= DUPLICATE_SIMILARITY_LIMIT) {
          return {
            isDuplicate: true,
            duplicateOf: issue.id,
            duplicateIssue: issue,
            distance: Math.round(distance),
            similarity: Math.round(similarity * 100) / 100
          };
        }
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Identify clusters of issues that represent urgent hotspots
 */
function analyzeHotspots(issues) {
  const activeIssues = issues.filter(i => ['reported', 'verified', 'in_progress'].includes(i.status));
  const hotspots = [];
  const CLUSTER_DISTANCE = 200; // meters
  const MIN_ISSUES_FOR_HOTSPOT = 3;

  const visited = new Set();

  for (let i = 0; i < activeIssues.length; i++) {
    if (visited.has(activeIssues[i].id)) continue;

    const cluster = [activeIssues[i]];
    visited.add(activeIssues[i].id);

    for (let j = 0; j < activeIssues.length; j++) {
      if (i === j || visited.has(activeIssues[j].id)) continue;

      const dist = getDistance(
        activeIssues[i].latitude,
        activeIssues[i].longitude,
        activeIssues[j].latitude,
        activeIssues[j].longitude
      );

      if (dist <= CLUSTER_DISTANCE) {
        cluster.push(activeIssues[j]);
        visited.add(activeIssues[j].id);
      }
    }

    if (cluster.length >= MIN_ISSUES_FOR_HOTSPOT) {
      // Calculate cluster centroid
      let sumLat = 0, sumLon = 0;
      cluster.forEach(item => {
        sumLat += item.latitude;
        sumLon += item.longitude;
      });
      
      hotspots.push({
        id: `hotspot-${i}`,
        latitude: sumLat / cluster.length,
        longitude: sumLon / cluster.length,
        issuesCount: cluster.length,
        categoryBreakdown: cluster.reduce((acc, curr) => {
          acc[curr.category] = (acc[curr.category] || 0) + 1;
          return acc;
        }, {}),
        severity: cluster.some(item => item.severity === 'high') ? 'high' : 'medium',
        issues: cluster.map(item => ({ id: item.id, title: item.title }))
      });
    }
  }

  return hotspots;
}

/**
 * Predict issue trends for the upcoming weeks
 */
function generateForecast(issues) {
  // Aggregate issues by week starting date
  const weeklyCounts = {};
  
  issues.forEach(issue => {
    const date = new Date(issue.created_at);
    // Get start of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const startOfWeek = new Date(date.setDate(diff)).toISOString().split('T')[0];
    
    weeklyCounts[startOfWeek] = (weeklyCounts[startOfWeek] || 0) + 1;
  });

  const sortedWeeks = Object.keys(weeklyCounts).sort();
  const counts = sortedWeeks.map(week => weeklyCounts[week]);

  if (counts.length < 2) {
    return {
      historical: sortedWeeks.map((week, idx) => ({ week, count: counts[idx] })),
      predictedNextWeek: counts[0] || 5,
      confidence: 'low'
    };
  }

  // Simple Linear Regression: y = mx + c
  const n = counts.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += counts[i];
    sumXY += i * counts[i];
    sumXX += i * i;
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const c = (sumY - m * sumX) / n;

  // Predict next 3 weeks
  const predictions = [];
  for (let i = 0; i < 3; i++) {
    const nextIdx = n + i;
    const predictedCount = Math.max(0, Math.round(m * nextIdx + c));
    const nextWeekDate = new Date(sortedWeeks[sortedWeeks.length - 1]);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7 * (i + 1));
    const weekStr = nextWeekDate.toISOString().split('T')[0];
    predictions.push({ week: weekStr, count: predictedCount, isPrediction: true });
  }

  const historical = sortedWeeks.map((week, idx) => ({ week, count: counts[idx] }));

  return {
    historical,
    predictions,
    trend: m > 0 ? 'increasing' : m < 0 ? 'decreasing' : 'stable',
    confidence: n > 4 ? 'high' : 'medium'
  };
}

module.exports = {
  autoCategorize,
  detectDuplicate,
  analyzeHotspots,
  generateForecast
};
