import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStats } from '../server/db/store.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.json(getStats());
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
