import express from 'express';

const router = express.Router();

// Advanced Analytics page
router.get('/', (req, res) => {
  res.sendFile('advanced-analytics.html', { root: 'public' });
});

export default router;


