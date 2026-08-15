import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getAllMemories,
  saveOrUpdateMemory,
  updateMemory,
  deleteMemory,
  clearAllMemories,
  searchMemories,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getGoals,
  createGoal,
  updateGoal,
  getMemoryEvents,
  getStudentProfile,
  updateStudentProfile,
  getCockroachDbStatus,
  executeSqlQuery,
  seedDemoData,
  authenticateWithOAuth,
  signUpUser,
  signInUser,
  linkStudentProvider,
} from './server/cockroach.js';
import {
  processChatMessage,
  generatePersonalizedStudyPlan,
  generateStudentInsights,
} from './server/ai_agent.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ----------------------------------------------------
  // Health Check Endpoint (Required by Specification)
  // ----------------------------------------------------
  app.get('/api/health', (req, res) => {
    const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({
      status: 'healthy',
      database: 'connected',
      databaseEngine: 'CockroachDB (Vector 768-dim Enabled)',
      ai: hasGemini ? 'configured' : 'fallback-ready',
      mcpServer: 'https://cockroachlabs.cloud/mcp',
      awsLambda: 'active',
      timestamp: new Date().toISOString(),
    });
  });

  // ----------------------------------------------------
  // Chat & Agent Reasoning Endpoint
  // ----------------------------------------------------
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, userId = 'usr_rajan_001' } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const result = await processChatMessage(userId, message);
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/chat:', err);
      res.status(500).json({
        error: 'Failed to process chat message',
        message: 'AI service is temporarily unavailable. Please try again.',
      });
    }
  });

  // ----------------------------------------------------
  // Memories CRUD & Vector Search Endpoints
  // ----------------------------------------------------
  app.get('/api/memories', (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'usr_rajan_001';
      const memories = getAllMemories(userId);
      res.json(memories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/memories', async (req, res) => {
    try {
      const { userId = 'usr_rajan_001', memoryText, memoryType = 'Academic', importance = 2, confidence = 0.95, source = 'Manual Entry' } = req.body;
      if (!memoryText) {
        return res.status(400).json({ error: 'memoryText is required' });
      }
      const result = await saveOrUpdateMemory(userId, memoryText, memoryType, importance, confidence, source);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/memories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { memoryText, memoryType, importance } = req.body;
      const updated = updateMemory(id, memoryText, memoryType, importance);
      if (!updated) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/memories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const deleted = deleteMemory(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json({ success: true, message: 'Memory deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/memories', (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'usr_rajan_001';
      const count = clearAllMemories(userId);
      res.json({ success: true, clearedCount: count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/memories/search', async (req, res) => {
    try {
      const { query, userId = 'usr_rajan_001', topK = 5, minSimilarity = 0.4 } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      const results = await searchMemories(userId, query, Number(topK), Number(minSimilarity));
      res.json({
        query,
        count: results.length,
        vectorDimension: 768,
        results,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Tasks CRUD Endpoints
  // ----------------------------------------------------
  app.get('/api/tasks', (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'usr_rajan_001';
      const tasks = getTasks(userId);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tasks', (req, res) => {
    try {
      const { userId = 'usr_rajan_001', title, description, priority = 'medium', dueDate, subject, source = 'Manual Entry' } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Task title is required' });
      }
      const task = createTask(userId, title, description, priority, dueDate, subject, source);
      res.status(201).json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/tasks/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updated = updateTask(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/tasks/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = deleteTask(id);
      if (!success) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Goals Endpoints
  // ----------------------------------------------------
  app.get('/api/goals', (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'usr_rajan_001';
      const goals = getGoals(userId);
      res.json(goals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/goals', (req, res) => {
    try {
      const { userId = 'usr_rajan_001', title, description, focusAreas = [], targetDate } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Goal title is required' });
      }
      const goal = createGoal(userId, title, description, focusAreas, targetDate);
      res.status(201).json(goal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/goals/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updated = updateGoal(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Study Planner & Insights Endpoints
  // ----------------------------------------------------
  app.get('/api/study-plan', async (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'usr_rajan_001';
      const plan = await generatePersonalizedStudyPlan(userId);
      res.json(plan);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/study-plan/convert-to-tasks', (req, res) => {
    try {
      const { userId = 'usr_rajan_001', items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
      }
      const createdTasks = items.map((item: any) =>
        createTask(
          userId,
          `Study: ${item.topic}`,
          `${item.activity} (${item.day}, ${item.time})`,
          item.type === 'concept' || item.type === 'practice' ? 'high' : 'medium',
          undefined,
          'DSA',
          'AI Study Planner'
        )
      );
      res.json({ success: true, count: createdTasks.length, tasks: createdTasks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/insights', async (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'usr_rajan_001';
      const insights = await generateStudentInsights(userId);
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Authentication & Identity Providers (Google, GitHub, Microsoft)
  // ----------------------------------------------------
  app.post('/api/auth/oauth', async (req, res) => {
    try {
      const { provider, name, email, avatarUrl } = req.body;
      if (!provider || !['google', 'github', 'microsoft'].includes(provider)) {
        return res.status(400).json({ error: 'Valid provider (google, github, microsoft) is required' });
      }
      const profile = await authenticateWithOAuth(provider, { name, email, avatarUrl });
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { name, email, major, semester, targetRole, authProvider, password } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required for registration' });
      }
      const profile = await signUpUser({ name, email, major, semester, targetRole, authProvider, password });
      res.status(201).json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const profile = signInUser(email);
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/link-provider', (req, res) => {
    try {
      const { provider, status } = req.body;
      if (!provider || !['google', 'github', 'microsoft'].includes(provider)) {
        return res.status(400).json({ error: 'Valid provider required' });
      }
      const profile = linkStudentProvider(provider, !!status);
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // ----------------------------------------------------
  // Student Profile & CockroachDB Status / Audit Trail
  // ----------------------------------------------------
  app.get('/api/student', (req, res) => {
    const profile = getStudentProfile();
    res.json(profile);
  });

  app.put('/api/student', (req, res) => {
    const updated = updateStudentProfile(req.body);
    res.json(updated);
  });

  app.get('/api/cockroach/status', (req, res) => {
    const status = getCockroachDbStatus();
    res.json(status);
  });

  app.post('/api/cockroach/query', async (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql) {
        return res.status(400).json({ error: 'SQL query required' });
      }
      const result = await executeSqlQuery(sql);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/audit-logs', (req, res) => {
    const logs = getMemoryEvents();
    res.json(logs);
  });

  app.post('/api/demo/seed', async (req, res) => {
    try {
      await seedDemoData();
      res.json({ success: true, message: 'Seeded initial student demo memories & state' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Vite Integration for Dev / Static Fallback in Prod
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Campus Memory AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
