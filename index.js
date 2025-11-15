const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Importar rotas
const cronRoutes = require('./routes/cron');
const questionsRoutes = require('./routes/questions');
const cleanupRoutes = require('./routes/cleanup');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Lista de origens permitidas
const allowedOrigins = [
  'https://appestuda-6162a6e3.base44.app', // Produção Base44
  'http://localhost:5173', // Desenvolvimento local
  'http://localhost:3000', // Desenvolvimento local alternativo
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite requests sem origin (Postman, curl, mobile apps)
    if (!origin) return callback(null, true);
    
    // Permite qualquer subdomínio .base44.app ou .modal.host (Base44 editor)
    if (
      allowedOrigins.includes(origin) ||
      origin.includes('.base44.app') ||
      origin.includes('.modal.host')
    ) {
      return callback(null, true);
    }
    
    console.log(`❌ CORS bloqueou origem: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Health check - Raiz
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'AppEstuda Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check - Detalhado
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Rotas
app.use('/cron', cronRoutes);
app.use('/questions', questionsRoutes);
app.use('/cleanup', cleanupRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Algo deu errado!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.originalUrl 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});