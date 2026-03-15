// ============================================================
// Zalo Server — Multi-tenant REST API
// Deploy on Railway / Render
// ============================================================
import express from 'express';
import cors from 'cors';
import { sessionManager } from './src/session-manager.js';
import { authMiddleware } from './src/middleware/auth.js';
import authRoutes from './src/routes/auth.js';
import messageRoutes from './src/routes/message.js';
import contactRoutes from './src/routes/contact.js';

const app = express();
const PORT = process.env.PORT || 3456;

// Middleware
app.use(cors());
app.use(express.json());

// Health check (không cần auth)
app.get('/', (req, res) => {
  const stats = sessionManager.getStats();
  res.json({
    name: 'Zalo Server',
    version: '1.0.0',
    status: 'running',
    ...stats
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Zalo API routes (yêu cầu auth)
app.use('/zalo', authMiddleware, authRoutes);
app.use('/zalo', authMiddleware, messageRoutes);
app.use('/zalo', authMiddleware, contactRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start
async function main() {
  console.log('[Server] 🚀 Initializing sessions...');
  await sessionManager.init();

  app.listen(PORT, () => {
    console.log(`[Server] ✅ Running on port ${PORT}`);
    console.log(`[Server] 📡 API: http://localhost:${PORT}/zalo`);
  });
}

main().catch(err => {
  console.error('[Server] ❌ Fatal:', err);
  process.exit(1);
});
