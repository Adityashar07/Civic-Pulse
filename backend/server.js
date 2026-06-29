const express = require('express');
const cors = require('cors');
const path = require('path');
const { 
  initDatabase, 
  dbAll, 
  dbRun, 
  dbGet 
} = require('./database');
const { 
  autoCategorize, 
  detectDuplicate, 
  analyzeHotspots, 
  generateForecast 
} = require('./ai_engine');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

console.log(path.join(__dirname, '..','frontend'));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..','frontend')));

// Endpoint: Check duplicate before reporting
app.post('/api/issues/check-duplicate', async (req, res) => {
  try {
    const { title, description, latitude, longitude } = req.body;
    if (!title || !description || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing title, description, latitude, or longitude' });
    }

    const issues = await dbAll('SELECT * FROM issues');
    const checkResult = detectDuplicate({ title, description, latitude, longitude }, issues);
    res.json(checkResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: AI auto-categorization and severity helper
app.post('/api/issues/analyze-text', (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title && !description) {
      return res.status(400).json({ error: 'Missing title or description' });
    }
    const analysis = autoCategorize(title || '', description || '');
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get all issues
app.get('/api/issues', async (req, res) => {
  try {
    const category = req.query.category;
    const status = req.query.status;

    let query = 'SELECT issues.*, users.username as reporter_name FROM issues LEFT JOIN users ON issues.reporter_id = users.id';
    const params = [];
    const conditions = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const issues = await dbAll(query, params);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Report a new issue
app.post('/api/issues', async (req, res) => {
  try {
    const { title, description, latitude, longitude, address, image_url, reporter_id } = req.body;
    
    if (!title || !description || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userId = reporter_id || 1; // Default to first user if not provided

    // 1. Run AI auto-categorization
    const aiAnalysis = autoCategorize(title, description);
    
    // 2. Run AI duplication check
    const existingIssues = await dbAll('SELECT * FROM issues');
    const dupCheck = detectDuplicate({ title, description, latitude, longitude }, existingIssues);
    
    const finalStatus = dupCheck.isDuplicate ? 'duplicate' : 'reported';
    const createdAt = new Date().toISOString();

    // 3. Insert issue
    const result = await dbRun(
      `INSERT INTO issues (title, description, category, status, severity, latitude, longitude, address, image_url, reporter_id, upvotes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description,
        aiAnalysis.category,
        finalStatus,
        aiAnalysis.severity,
        latitude,
        longitude,
        address || 'Hyperlocal coordinates',
        image_url || null,
        userId,
        0,
        createdAt,
        createdAt
      ]
    );

    const newIssue = await dbGet('SELECT * FROM issues WHERE id = ?', [result.lastID]);

    // 4. Reward reputation points if it is NOT a duplicate
    if (!dupCheck.isDuplicate) {
      await dbRun(
        'UPDATE users SET reputation_points = reputation_points + 15 WHERE id = ?',
        [userId]
      );
      
      // Update badges if user reaches milestone
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
      const currentBadges = JSON.parse(user.badges || '[]');
      if (user.reputation_points >= 150 && !currentBadges.includes('Active Reporter')) {
        currentBadges.push('Active Reporter');
        await dbRun('UPDATE users SET badges = ? WHERE id = ?', [JSON.stringify(currentBadges), userId]);
      }
    }

    res.status(201).json({
      message: dupCheck.isDuplicate ? 'Issue reported, but flagged as duplicate.' : 'Issue successfully reported!',
      issue: newIssue,
      aiAnalysis,
      duplicateCheck: dupCheck
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Upvote an issue
app.post('/api/issues/:id/upvote', async (req, res) => {
  try {
    const issueId = req.params.id;
    const issue = await dbGet('SELECT * FROM issues WHERE id = ?', [issueId]);

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    await dbRun('UPDATE issues SET upvotes = upvotes + 1 WHERE id = ?', [issueId]);
    
    // Reward points to reporter
    if (issue.reporter_id) {
      await dbRun(
        'UPDATE users SET reputation_points = reputation_points + 5 WHERE id = ?',
        [issue.reporter_id]
      );
    }

    const updatedIssue = await dbGet('SELECT * FROM issues WHERE id = ?', [issueId]);
    res.json(updatedIssue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Update issue status (Official / Moderator action)
app.patch('/api/issues/:id/status', async (req, res) => {
  try {
    const issueId = req.params.id;
    const { status, official_id } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const issue = await dbGet('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const updatedAt = new Date().toISOString();
    await dbRun(
      'UPDATE issues SET status = ?, updated_at = ? WHERE id = ?',
      [status, updatedAt, issueId]
    );

    // If resolved, award significant points to original reporter
    if (status === 'resolved' && issue.status !== 'resolved') {
      await dbRun(
        'UPDATE users SET reputation_points = reputation_points + 50 WHERE id = ?',
        [issue.reporter_id]
      );
      // Give badge if reputation is high
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [issue.reporter_id]);
      const currentBadges = JSON.parse(user.badges || '[]');
      if (user.reputation_points >= 300 && !currentBadges.includes('Community Hero')) {
        currentBadges.push('Community Hero');
        await dbRun('UPDATE users SET badges = ? WHERE id = ?', [JSON.stringify(currentBadges), issue.reporter_id]);
      }
    }

    const updatedIssue = await dbGet('SELECT * FROM issues WHERE id = ?', [issueId]);
    res.json(updatedIssue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get comments for an issue
app.get('/api/issues/:id/comments', async (req, res) => {
  try {
    const issueId = req.params.id;
    const comments = await dbAll(
      `SELECT comments.*, users.username, users.role 
       FROM comments 
       JOIN users ON comments.user_id = users.id 
       WHERE comments.issue_id = ? 
       ORDER BY comments.created_at ASC`,
      [issueId]
    );
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Post a comment
app.post('/api/issues/:id/comments', async (req, res) => {
  try {
    const issueId = req.params.id;
    const { content, user_id } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const userId = user_id || 1;
    const createdAt = new Date().toISOString();

    const result = await dbRun(
      'INSERT INTO comments (issue_id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
      [issueId, userId, content, createdAt]
    );

    // Increase user reputation points slightly for participating in community discussion
    await dbRun('UPDATE users SET reputation_points = reputation_points + 2 WHERE id = ?', [userId]);

    const newComment = await dbGet(
      `SELECT comments.*, users.username, users.role 
       FROM comments 
       JOIN users ON comments.user_id = users.id 
       WHERE comments.id = ?`,
      [result.lastID]
    );

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Users Leaderboard
app.get('/api/users/leaderboard', async (req, res) => {
  try {
    const users = await dbAll('SELECT id, username, reputation_points, role, badges FROM users ORDER BY reputation_points DESC LIMIT 10');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Analytics and Predictive Insights Dashboard
app.get('/api/analytics', async (req, res) => {
  try {
    const allIssues = await dbAll('SELECT * FROM issues');
    
    // 1. Issue Category breakdown
    const categories = {
      pothole: 0,
      water_leak: 0,
       streetlight: 0,
      waste_management: 0,
      infrastructure: 0,
      other: 0
    };
    
    // 2. Issue Status breakdown
    const status = {
      reported: 0,
      verified: 0,
      in_progress: 0,
      resolved: 0,
      duplicate: 0
    };

    allIssues.forEach(issue => {
      if (categories[issue.category] !== undefined) {
        categories[issue.category]++;
      } else {
        categories.other++;
      }
      if (status[issue.status] !== undefined) {
        status[issue.status]++;
      }
    });

    // 3. Hotspots calculation
    const hotspots = analyzeHotspots(allIssues);

    // 4. Temporal Trend Forecasting
    const forecast = generateForecast(allIssues);

    // 5. Avg Resolution Time (in days)
    const resolvedIssues = allIssues.filter(i => i.status === 'resolved' && i.created_at && i.updated_at);
    let totalResolutionTimeMs = 0;
    resolvedIssues.forEach(issue => {
      const created = new Date(issue.created_at);
      const updated = new Date(issue.updated_at);
      totalResolutionTimeMs += (updated - created);
    });
    
    const avgResolutionDays = resolvedIssues.length > 0 
      ? Math.round((totalResolutionTimeMs / (1000 * 60 * 60 * 24)) / resolvedIssues.length * 10) / 10
      : 0;

    res.json({
      totalIssues: allIssues.length,
      categoryBreakdown: categories,
      statusBreakdown: status,
      hotspots,
      forecast,
      avgResolutionDays
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run DB Initialization, then Seed, then start server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Open Dashboard at http://localhost:${PORT}/static/index.html`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
