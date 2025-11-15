const express = require('express');
const router = express.Router();
const { cleanupNotifications } = require('../services/questionService');

// Middleware de autenticação para rotas de cleanup
const authenticateCleanup = (req, res, next) => {
  const token = req.headers['x-cron-token'];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Token de cron não fornecido',
      header: 'x-cron-token'
    });
  }
  
  if (token !== process.env.CRON_SECRET_TOKEN) {
    return res.status(401).json({ 
      error: 'Token de cron inválido',
      provided: token.substring(0, 10) + '...'
    });
  }
  
  next();
};

// Aplicar autenticação em todas as rotas
router.use(authenticateCleanup);

// POST /cleanup/notifications - Limpa notificações antigas
router.post('/notifications', async (req, res) => {
  try {
    console.log('🧹 Iniciando limpeza de notificações antigas...');
    
    const deletedCount = await cleanupNotifications();
    
    console.log(`✅ Limpeza concluída: ${deletedCount} notificações removidas`);
    
    res.json({
      message: 'Limpeza de notificações concluída',
      deletedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro na limpeza de notificações:', error);
    res.status(500).json({
      error: 'Erro ao limpar notificações',
      message: error.message
    });
  }
});

// GET /cleanup/status - Verifica status do sistema de cleanup
router.get('/status', (req, res) => {
  try {
    res.json({
      service: 'cleanup',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: [
        'POST /cleanup/notifications - Limpa notificações antigas (>30 dias)'
      ]
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    res.status(500).json({
      error: 'Erro ao verificar status',
      message: error.message
    });
  }
});

module.exports = router;