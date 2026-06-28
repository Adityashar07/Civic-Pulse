const assert = require('assert').strict;
const { 
  autoCategorize, 
  detectDuplicate, 
  analyzeHotspots, 
  generateForecast 
} = require('./ai_engine');

function runTests() {
  console.log('--- Running AI Engine Logic Tests ---');

  // Test 1: Auto-Categorization
  console.log('Test 1: Auto-Categorization...');
  
  const p1 = autoCategorize('Big pothole on the sector road', 'There is a deep damaged hole in the asphalt');
  assert.equal(p1.category, 'pothole', 'Should classify as pothole');
  assert.equal(p1.severity, 'medium', 'Should classify as medium severity');

  const p2 = autoCategorize('Dangerous water main burst flooding school lane', 'A pipe burst and it is high danger for kids');
  assert.equal(p2.category, 'water_leak', 'Should classify as water_leak');
  assert.equal(p2.severity, 'high', 'Should classify as high severity');

  const p3 = autoCategorize('Damaged park bench', 'The bench wood is slightly cracked.');
  assert.equal(p3.category, 'infrastructure', 'Should classify as infrastructure');
  assert.equal(p3.severity, 'medium', 'Should classify as medium severity');

  console.log('✅ Test 1 Passed');

  // Test 2: Duplicate Detection
  console.log('Test 2: Duplicate Detection...');
  
  const existingIssues = [
    {
      id: 1,
      title: 'Water pipe leak near primary school',
      description: 'Clean water is leaking onto the pavement.',
      category: 'water_leak',
      status: 'reported',
      latitude: 28.6130,
      longitude: 77.2090
    }
  ];

  const draftIssueClose = {
    title: 'Water leakage close to school entrance',
    description: 'Clean drinking water is leaking and puddle is forming.',
    latitude: 28.6131, // ~15m away
    longitude: 77.2090
  };

  const dupResultClose = detectDuplicate(draftIssueClose, existingIssues);
  assert.equal(dupResultClose.isDuplicate, true, 'Should detect duplicate for close distance + overlapping text');
  assert.equal(dupResultClose.duplicateOf, 1);

  const draftIssueFar = {
    title: 'Water leakage close to school entrance',
    description: 'Clean drinking water is leaking and puddle is forming.',
    latitude: 28.6250, // ~1.5km away
    longitude: 77.2090
  };
  const dupResultFar = detectDuplicate(draftIssueFar, existingIssues);
  assert.equal(dupResultFar.isDuplicate, false, 'Should NOT detect duplicate for far distance even with same text');

  console.log('✅ Test 2 Passed');

  // Test 3: Hotspot Clustering
  console.log('Test 3: Hotspot Clustering...');
  
  const clusterIssues = [
    { id: 101, category: 'pothole', status: 'reported', latitude: 28.6150, longitude: 77.2110 },
    { id: 102, category: 'pothole', status: 'reported', latitude: 28.6151, longitude: 77.2111 },
    { id: 103, category: 'pothole', status: 'reported', latitude: 28.6149, longitude: 77.2109 },
    // Isolated issue
    { id: 104, category: 'water_leak', status: 'reported', latitude: 28.6500, longitude: 77.2500 }
  ];

  const hotspots = analyzeHotspots(clusterIssues);
  assert.equal(hotspots.length, 1, 'Should find exactly 1 hotspot cluster');
  assert.equal(hotspots[0].issuesCount, 3, 'Hotspot cluster should contain 3 issues');
  assert.deepEqual(hotspots[0].categoryBreakdown, { pothole: 3 });

  console.log('✅ Test 3 Passed');

  // Test 4: Forecasting
  console.log('Test 4: Temporal Trend Forecasting...');
  
  const mockHistoricalIssues = [];
  const start = new Date('2026-04-01');
  
  // Create 8 weeks of historical data
  for (let week = 0; week < 8; week++) {
    const issueDate = new Date(start);
    issueDate.setDate(start.getDate() + week * 7);
    
    // Add varying counts per week: week 0: 2, week 1: 3, week 2: 4, etc. (strictly increasing linear trend)
    const count = 2 + week; 
    for (let c = 0; c < count; c++) {
      mockHistoricalIssues.push({
        created_at: issueDate.toISOString()
      });
    }
  }

  const forecast = generateForecast(mockHistoricalIssues);
  assert.equal(forecast.historical.length, 8, 'Should aggregate 8 historical weeks');
  assert.equal(forecast.trend, 'increasing', 'Should correctly detect increasing trend');
  assert.ok(forecast.predictions.length > 0, 'Should generate predictions');
  assert.ok(forecast.predictions[0].count > 8, 'Prediction count should continue linear growth (> 8)');

  console.log('✅ Test 4 Passed');

  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
}

runTests();
