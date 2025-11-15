const express = require('express');
const router = express.Router();

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

// POST /cleanup/notifications - Limpa notificações antigas via Base44 Function
router.post('/notifications', async (req, res) => {
  const FUNCAO_URL = 'https://base44.app/api/apps/6910a14f39e954f56162a6e3/functions/limparNotificacoes';
  const CRON_SECRET = process.env.CRON_SHARED_SECRET;

  try {
    const response = await fetch(FUNCAO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': CRON_SECRET
      }
    });

    if (!response.ok) {
      throw new Error(`Base44 retornou ${response.status}`);
    }

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Erro ao limpar notificações:', error);
    res.status(500).json({ error: error.message });
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