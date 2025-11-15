const express = require('express');
const router = express.Router();

// POST /questions/generate - Encaminha para função Base44
router.post('/generate', async (req, res) => {
  const FUNCAO_URL = 'https://base44.app/api/apps/6910a14f39e954f56162a6e3/functions/gerarQuestoes';
  const CRON_SECRET = process.env.CRON_SHARED_SECRET;

  try {
    await fetch(FUNCAO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': CRON_SECRET
      },
      body: JSON.stringify(req.body)
    });

    res.json({ success: true, message: 'Geração iniciada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /questions/status/:jobId - Verifica status de uma geração
router.get('/status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Em produção, isso viria do banco de dados
    // Por enquanto, retornamos um status genérico
    res.json({
      jobId,
      status: 'PROCESSING',
      progress: 0,
      message: 'Processando...',
      timestamp: new Date().toISOString()
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