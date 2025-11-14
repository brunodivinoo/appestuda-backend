const axios = require('axios');

const BASE44_FUNCTIONS = 'https://base44.app/api/apps/6910a14f39e954f56162a6e3/functions';
const SHARED_SECRET = process.env.BASE44_SHARED_SECRET;

const api = axios.create({
  baseURL: BASE44_FUNCTIONS,
  headers: {
    'x-shared-secret': SHARED_SECRET,
    'Content-Type': 'application/json'
  },
  timeout: 60000 // 60 segundos
});

async function finalizeExpired() {
  console.log('📅 Chamando função Base44: finalizarSessoesExpiradas...');
  
  try {
    const { data } = await api.post('/finalizarSessoesExpiradas', {});
    
    console.log('✅ Resposta:', data);
    
    return data;
    
  } catch (error) {
    console.error('❌ Erro ao chamar função Base44:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

module.exports = { finalizeExpired };