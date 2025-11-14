const express = require('express');
const router = express.Router();
const questionService = require('../services/questionService');

// Adicionar à fila de geração
router.post('/generate', async (req, res) => {
  try {
    const { usuario_id, disciplina_id, quantidade, dificuldade } = req.body;
    
    // Validações
    if (!usuario_id || !disciplina_id || !quantidade) {
      return res.status(400).json({
        error: 'Campos obrigatórios: usuario_id, disciplina_id, quantidade'
      });
    }
    
    if (quantidade < 1 || quantidade > 100) {
      return res.status(400).json({
        error: 'Quantidade deve ser entre 1 e 100'
      });
    }
    
    const result = await questionService.addToQueue({
      usuario_id,
      disciplina_id,
      quantidade,
      dificuldade: dificuldade || 'media'
    });
    
    res.json({
      success: true,
      ...result,
      message: 'Geração de questões iniciada!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao adicionar à fila:', error.message);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Verificar status da geração
router.get('/status/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    const status = await questionService.getJobStatus(job_id);
    
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.message);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;