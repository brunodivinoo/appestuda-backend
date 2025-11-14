const axios = require('axios');

const BASE44_FUNCTIONS = 'https://base44.app/api/apps/6910a14f39e954f56162a6e3/functions';
const SHARED_SECRET = process.env.BASE44_SHARED_SECRET;

const api = axios.create({
  baseURL: BASE44_FUNCTIONS,
  headers: {
    'x-shared-secret': SHARED_SECRET,
    'Content-Type': 'application/json'
  },
  timeout: 60000
});

async function finalizeExpired() {
  console.log('📅 Chamando função Base44: finalizarDesafiosExpirados...');
  
  try {
    const { data } = await api.post('/finalizarDesafiosExpirados', {});
    console.log('✅ Resposta:', data);
    return data;
  } catch (error) {
    console.error('❌ Erro ao chamar função Base44:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function createDailyChallenges() {
  console.log('📅 Chamando função Base44: criarDesafiosDiarios...');
  
  try {
    const { data } = await api.post('/criarDesafiosDiarios', {});
    console.log('✅ Resposta:', data);
    return data;
  } catch (error) {
    console.error('❌ Erro ao chamar função Base44:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function createWeeklyChallenges() {
  console.log('📅 Chamando função Base44: criarDesafiosSemanais...');
  
  try {
    const { data } = await api.post('/criarDesafiosSemanais', {});
    console.log('✅ Resposta:', data);
    return data;
  } catch (error) {
    console.error('❌ Erro ao chamar função Base44:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function createMonthlyChallenges() {
  console.log('📅 Chamando função Base44: criarDesafiosMensais...');
  
  try {
    const { data } = await api.post('/criarDesafiosMensais', {});
    console.log('✅ Resposta:', data);
    return data;
  } catch (error) {
    console.error('❌ Erro ao chamar função Base44:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

module.exports = {
  finalizeExpired,
  createDailyChallenges,
  createWeeklyChallenges,
  createMonthlyChallenges
};