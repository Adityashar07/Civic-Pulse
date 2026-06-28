const { dbRun, initDatabase } = require('./database');

async function seed() {
  console.log('Initializing database tables...');
  await initDatabase();

  console.log('Seeding historical issue reports...');

  // Base coordinates around New Delhi
  const baseLat = 28.6139;
  const baseLng = 77.2090;

  // List of realistic historical issues
  const historicalIssues = [
    // Hotspot 1: Sector 4 Waste Management Cluster (approx 28.6150, 77.2110)
    {
      title: 'Overflowing Garbage Bin near Sector 4 Market',
      description: 'The community trash bin is overflowing and stray animals are spreading garbage everywhere. High health risk.',
      category: 'waste_management',
      status: 'resolved',
      severity: 'medium',
      latitude: 28.6152,
      longitude: 77.2111,
      address: 'Sector 4 Main Market, New Delhi',
      upvotes: 45,
      daysAgo: 50
    },
    {
      title: 'Illegal dumping on Sector 4 empty plot',
      description: 'Construction debris and domestic waste being dumped in the open plot. Smells awful and attracts rodents.',
      category: 'waste_management',
      status: 'resolved',
      severity: 'medium',
      latitude: 28.6154,
      longitude: 77.2109,
      address: 'Plot 12, Sector 4, New Delhi',
      upvotes: 28,
      daysAgo: 45
    },
    {
      title: 'Garbage dump near Sector 4 primary school',
      description: 'Huge pile of garbage accumulated on the sidewalk right next to the school entrance. Hazardous for kids.',
      category: 'waste_management',
      status: 'in_progress',
      severity: 'high',
      latitude: 28.6150,
      longitude: 77.2115,
      address: 'Sector 4 Primary School Road, New Delhi',
      upvotes: 55,
      daysAgo: 10
    },
    {
      title: 'Unattended plastic waste heap',
      description: 'Litter and plastic bags clogging the pedestrian path in Sector 4 block B.',
      category: 'waste_management',
      status: 'reported',
      severity: 'low',
      latitude: 28.6151,
      longitude: 77.2112,
      address: 'Block B Crossing, Sector 4, New Delhi',
      upvotes: 12,
      daysAgo: 2
    },

    // Hotspot 2: Metro Station Streetlight Blackout (approx 28.6120, 77.2050)
    {
      title: 'Dark Alley near Metro Station Exit 2',
      description: 'Three consecutive streetlights are broken. Extremely dark and unsafe for commuters returning late at night.',
      category: 'streetlight',
      status: 'in_progress',
      severity: 'high',
      latitude: 28.6122,
      longitude: 77.2053,
      address: 'Metro Station Exit 2 Road, New Delhi',
      upvotes: 82,
      daysAgo: 15
    },
    {
      title: 'Flickering streetlamp on Station Road',
      description: 'Streetlight pole #32 is flickering constantly, creating low visibility and causing eye strain.',
      category: 'streetlight',
      status: 'reported',
      severity: 'low',
      latitude: 28.6119,
      longitude: 77.2050,
      address: 'Station Road Near Petrol Pump, New Delhi',
      upvotes: 19,
      daysAgo: 4
    },
    {
      title: 'Complete power failure of streetlights',
      description: 'Entire block next to the metro station has no functioning lights. Pitch black after 7 PM.',
      category: 'streetlight',
      status: 'reported',
      severity: 'high',
      latitude: 28.6121,
      longitude: 77.2048,
      address: 'Sector 2 Metro Link Lane, New Delhi',
      upvotes: 64,
      daysAgo: 3
    },

    // Hotspot 3: Water Leakages near Central Park (approx 28.6135, 77.2090)
    {
      title: 'Main Pipeline burst near Central Park',
      description: 'Large amount of clean drinking water gushing out onto the road. Significant flooding and traffic slowdown.',
      category: 'water_leak',
      status: 'resolved',
      severity: 'high',
      latitude: 28.6136,
      longitude: 77.2092,
      address: 'Gate 3 Central Park, New Delhi',
      upvotes: 110,
      daysAgo: 30
    },
    {
      title: 'Slow leakage from underground valve',
      description: 'Water has been seeping through the road cracks for the last week. Road surface is getting soft.',
      category: 'water_leak',
      status: 'in_progress',
      severity: 'medium',
      latitude: 28.6134,
      longitude: 77.2088,
      address: 'Central Park West Circle, New Delhi',
      upvotes: 35,
      daysAgo: 12
    },
    {
      title: 'Dripping public hydrant',
      description: 'The tap on the public drinking water hydrant is broken and cannot be fully shut off.',
      category: 'water_leak',
      status: 'reported',
      severity: 'low',
      latitude: 28.6138,
      longitude: 77.2090,
      address: 'Central Park Outer Circle, New Delhi',
      upvotes: 14,
      daysAgo: 5
    },

    // Potholes (Scattered)
    {
      title: 'Deep pothole on Main Highway lane 2',
      description: 'Very dangerous crater in the middle of the speed lane. Cars are swerving suddenly to avoid it.',
      category: 'pothole',
      status: 'resolved',
      severity: 'high',
      latitude: 28.6210,
      longitude: 77.2012,
      address: 'Highway Flyover Start, New Delhi',
      upvotes: 95,
      daysAgo: 58
    },
    {
      title: 'Multiple potholes near market crossing',
      description: 'The asphalt has disintegrated completely. Very bumpy ride, scooters are slipping.',
      category: 'pothole',
      status: 'in_progress',
      severity: 'medium',
      latitude: 28.6080,
      longitude: 77.2180,
      address: 'Connaught Circus Sector 6, New Delhi',
      upvotes: 42,
      daysAgo: 25
    },
    {
      title: 'Pothole on zebra crossing',
      description: 'Deep pit right on the pedestrian crossing. Pedestrians can trip easily, especially at night.',
      category: 'pothole',
      status: 'reported',
      severity: 'medium',
      latitude: 28.6145,
      longitude: 77.2140,
      address: 'Vikas Marg Pedestrian Crossing, New Delhi',
      upvotes: 21,
      daysAgo: 6
    },

    // Infrastructure
    {
      title: 'Damaged Guard Rail on Pedestrian Bridge',
      description: 'A portion of the safety barrier on the foot overbridge is broken. Major fall risk for pedestrians.',
      category: 'infrastructure',
      status: 'in_progress',
      severity: 'high',
      latitude: 28.6180,
      longitude: 77.2070,
      address: 'Outer Circle Foot Bridge, New Delhi',
      upvotes: 73,
      daysAgo: 18
    },
    {
      title: 'Broken Park Bench in Kids Playground',
      description: 'Wooden bench is broken with sharp metal screws sticking out. Dangerous for kids playing nearby.',
      category: 'infrastructure',
      status: 'resolved',
      severity: 'medium',
      latitude: 28.6095,
      longitude: 77.2025,
      address: 'Childrens Park Block C, New Delhi',
      upvotes: 18,
      daysAgo: 40
    }
  ];

  // Distribute other generic historical points to build a continuous weekly timeline
  for (let i = 1; i <= 20; i++) {
    const categories = ['pothole', 'water_leak', 'streetlight', 'waste_management', 'infrastructure'];
    const selectedCategory = categories[i % categories.length];
    const daysAgo = Math.floor(Math.random() * 55) + 5; // between 5 and 60 days ago
    
    // Slight random offset from base coordinates
    const latOffset = (Math.random() - 0.5) * 0.03;
    const lngOffset = (Math.random() - 0.5) * 0.03;

    historicalIssues.push({
      title: `Historical ${selectedCategory.replace('_', ' ')} incident #${i}`,
      description: `Automatically generated record of a historical local issue reported by the community.`,
      category: selectedCategory,
      status: i % 3 === 0 ? 'in_progress' : i % 3 === 1 ? 'resolved' : 'reported',
      severity: i % 4 === 0 ? 'high' : i % 4 === 1 ? 'medium' : 'low',
      latitude: baseLat + latOffset,
      longitude: baseLng + lngOffset,
      address: `Street #${i}, Sector ${Math.floor(i/4) + 1}, New Delhi`,
      upvotes: Math.floor(Math.random() * 40),
      daysAgo
    });
  }

  // Insert records
  for (const issue of historicalIssues) {
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - issue.daysAgo);
    const createdStr = createdDate.toISOString();

    const updatedDate = new Date(createdDate);
    // Resolve/Progress happened a few days later
    updatedDate.setDate(updatedDate.getDate() + (issue.status === 'resolved' ? 4 : 2));
    const updatedStr = updatedDate.toISOString();

    // Random reporter (between 1 and 4)
    const reporterId = Math.floor(Math.random() * 4) + 1;

    await dbRun(
      `INSERT INTO issues (title, description, category, status, severity, latitude, longitude, address, reporter_id, upvotes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issue.title,
        issue.description,
        issue.category,
        issue.status,
        issue.severity,
        issue.latitude,
        issue.longitude,
        issue.address,
        reporterId,
        issue.upvotes,
        createdStr,
        updatedStr
      ]
    );
  }

  console.log(`Seeding completed. Inserted ${historicalIssues.length} issues.`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = seed;
