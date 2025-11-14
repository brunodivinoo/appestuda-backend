const express = require('express');
const router = express.Router();
const sessionService = require('../services/sessionService');
const challengeService = require('../services/challengeService');

// Middleware de autenticação
function authenticateCron(req, res, next) {
  const token = req.headers['x-cron-token'];
  
  if (!token) {
    console.log('❌ Missing x-cron-token header');
    return res.status(401).json({
      error: 'Missing x-cron-token header'
    });
  }
  
  if (token !== process.env.CRON_SECRET_TOKEN) {
    console.log('❌ Invalid cron token');
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
  
  next();
}

router.use(authenticateCron);

// Finalizar sessões expiradas
router.post('/finalize-sessions', async (req, res) => {
  try {
    console.log('🔄 [CRON] Iniciando finalização de sessões...');
    const result = await sessionService.finalizeExpired();
    console.log('✅ [CRON] Sessões finalizadas:', result);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [CRON] Erro ao finalizar sessões:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Finalizar desafios expirados
router.post('/finalize-challenges', async (req, res) => {
  try {
    console.log('🔄 [CRON] Iniciando finalização de desafios...');
    const result = await challengeService.finalizeExpired();
    console.log('✅ [CRON] Desafios finalizados:', result);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [CRON] Erro ao finalizar desafios:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Criar desafios diários
router.post('/create-daily-challenges', async (req, res) => {
  try {
    console.log('🔄 [CRON] Criando desafios diários...');
    const result = await challengeService.createDailyChallenges();
    console.log('✅ [CRON] Desafios diários criados:', result);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [CRON] Erro ao criar desafios diários:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Criar desafios semanais
router.post('/create-weekly-challenges', async (req, res) => {
  try {
    console.log('🔄 [CRON] Criando desafios semanais...');
    const result = await challengeService.createWeeklyChallenges();
    console.log('✅ [CRON] Desafios semanais criados:', result);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [CRON] Erro ao criar desafios semanais:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Criar desafios mensais
router.post('/create-monthly-challenges', async (req, res) => {
  try {
    console.log('🔄 [CRON] Criando desafios mensais...');
    const result = await challengeService.createMonthlyChallenges();
    console.log('✅ [CRON] Desafios mensais criados:', result);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [CRON] Erro ao criar desafios mensais:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;