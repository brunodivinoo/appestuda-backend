const express = require('express');
const router = express.Router();
const { generateQuestions } = require('../services/questionService');

// POST /questions/generate - Gera questões com OpenAI
router.post('/generate', async (req, res) => {
  try {
    const { jobId, estudoId, disciplinas, configuracoes } = req.body;

    // Validação básica
    if (!jobId || !estudoId || !disciplinas || !configuracoes) {
      return res.status(400).json({
        error: 'Campos obrigatórios faltando',
        required: ['jobId', 'estudoId', 'disciplinas', 'configuracoes']
      });
    }

    if (!Array.isArray(disciplinas) || disciplinas.length === 0) {
      return res.status(400).json({
        error: 'disciplinas deve ser um array não vazio'
      });
    }

    if (!configuracoes.quantidadeQuestoes || configuracoes.quantidadeQuestoes <= 0) {
      return res.status(400).json({
        error: 'configuracoes.quantidadeQuestoes deve ser maior que 0'
      });
    }

    // Gerar jobId único se não fornecido
    const finalJobId = jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 Iniciando geração de questões para job ${finalJobId}`);
    console.log(`📚 Matérias: ${disciplinas.join(', ')}`);
    console.log(`🔧 Configurações:`, configuracoes);

    // Iniciar processamento em background
    const jobData = {
      jobId: finalJobId,
      estudoId,
      disciplinas,
      configuracoes
    };

    // Processar em background - não esperar
    generateQuestions(jobData).catch(error => {
      console.error(`❌ Erro no processamento background do job ${finalJobId}:`, error);
    });

    // Retornar imediatamente
    res.json({
      message: 'Geração de questões iniciada em background',
      jobId: finalJobId,
      status: 'PROCESSING',
      estudoId,
      disciplinas,
      configuracoes
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar geração de questões:', error);
    res.status(500).json({
      error: 'Erro ao iniciar geração de questões',
      message: error.message
    });
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