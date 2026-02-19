import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { analyzeStartup } from '../lib/analyzer.js';
import { getStore, getStats as getDbStats } from './db/store.js';
import { startScheduler } from './agents/scheduler.js';

// Import routes
import jobsRouter from './routes/jobs.js';
import companiesRouter from './routes/companies.js';
import recommendRouter from './routes/recommend.js';
import filtersRouter from './routes/filters.js';
import adminRouter from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize store
getStore();

// Environment variables
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUB_ID;

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Job search engine API routes
app.use('/api/jobs', jobsRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/filters', filtersRouter);
app.use('/api/admin', adminRouter);

// Stats endpoint (also accessible via /api/filters/stats but convenient at top level)
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const stats = getDbStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Subscribe endpoint (Beehiiv)
app.post('/api/subscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) {
      // In dev mode without keys, just accept the email
      return res.status(200).json({ message: 'Subscribed (dev mode)' });
    }

    const response = await axios.post(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`,
      {
        email,
        reactivate_existing_subscriber: true,
        send_welcome_email: true,
      },
      {
        headers: {
          Authorization: `Bearer ${BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.status(200).json({
      message: 'Successfully subscribed',
      subscriber: response.data,
    });
  } catch (error: any) {
    console.error('Beehiiv API error:', error.response?.data || error.message);

    if (error.response?.status === 409) {
      return res.status(200).json({ message: 'Already subscribed' });
    }

    return res.status(500).json({
      message: error.response?.data?.message || 'Failed to subscribe',
    });
  }
});

// Legacy analyze endpoint
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });
    const result = await analyzeStartup(url);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Analysis error:', error.message);
    return res.status(500).json({ message: 'Failed to analyze the website.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start the cron scheduler for automated scraping
  if (process.env.ENABLE_SCHEDULER !== 'false') {
    startScheduler();
  }
});
