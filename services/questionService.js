const Queue = require('bull');
const OpenAI = require('openai');
const axios = require('axios');

const BASE44_API = 'https://base44.app/api/apps/6910a14f39e954f56162a6e3/entities';
const BASE44_TOKEN = process.env.BASE44_API_TOKEN;

const api = axios.create({
  baseURL: BASE44_API,
  headers: {
    'Authorization': `Bearer ${BASE44_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Criar fila (só se REDIS_URL existir)
let questionQueue;
if (process.env.REDIS_URL) {
  questionQueue = new Queue('question-generation', process.env.REDIS_URL);
  
  // Worker
  questionQueue.process(async (job) => {
    return await processQuestionGeneration(job);
  });
  
  console.log('✅ Fila de questões inicializada');
} else {
  console.warn('⚠️ REDIS_URL não configurado. Fila de questões desabilitada.');
}

async function addToQueue(data) {
  if (!questionQueue) {
    throw new Error('Fila de questões não configurada (Redis necessário)');
  }
  
  const job = await questionQueue.add(data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
  
  return { job_id: job.id.toString() };
}

async function getJobStatus(jobId) {
  if (!questionQueue) {
    return { status: 'not_configured' };
  }
  
  const job = await questionQueue.getJob(jobId);
  
  if (!job) {
    return { status: 'not_found' };
  }
  
  const state = await job.getState();
  const progress = job.progress();
  
  return {
    status: state,
    progresso: progress,
    resultado: job.returnvalue
  };
}

async function processQuestionGeneration(job) {
  const { disciplina_id, quantidade, dificuldade, usuario_id } = job.data;
  
  console.log(`🎯 Gerando ${quantidade} questões de ${dificuldade}...`);
  
  // Buscar disciplina
  const { data: disciplinas } = await api.get('/Disciplina', {
    params: { 'filter[id]': disciplina_id }
  });
  
  if (!disciplinas || disciplinas.length === 0) {
    throw new Error('Disciplina não encontrada');
  }
  
  const disciplina = disciplinas[0];
  const questoes = [];
  
  for (let i = 0; i < quantidade; i++) {
    try {
      const questaoData = await gerarQuestaoComIA(disciplina, dificuldade);
      
      // Salvar via Base44 API
      const { data } = await api.post('/Questao', questaoData);
      
      questoes.push(data);
      
      // Atualizar progresso
      job.progress(((i + 1) / quantidade) * 100);
      
      console.log(`✅ Questão ${i + 1}/${quantidade} gerada`);
      
      // Delay para não sobrecarregar OpenAI
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Erro ao gerar questão ${i + 1}:`, error.message);
    }
  }
  
  console.log(`🎉 ${questoes.length} questões geradas com sucesso!`);
  
  return {
    geradas: questoes.length,
    questoes: questoes.map(q => q.id)
  };
}

async function gerarQuestaoComIA(disciplina, dificuldade) {
  const prompt = `
Gere uma questão de múltipla escolha sobre: ${disciplina.titulo}
${disciplina.caminho_completo ? `Contexto: ${disciplina.caminho_completo}` : ''}

Dificuldade: ${dificuldade}

IMPORTANTE: Retorne APENAS um objeto JSON válido com esta estrutura:
{
  "enunciado": "Texto da questão aqui",
  "alternativas": [
    { "letra": "A", "texto": "Alternativa A" },
    { "letra": "B", "texto": "Alternativa B" },
    { "letra": "C", "texto": "Alternativa C" },
    { "letra": "D", "texto": "Alternativa D" },
    { "letra": "E", "texto": "Alternativa E" }
  ],
  "resposta_correta": "A",
  "explicacao": "Explicação detalhada da resposta correta"
}

NÃO inclua markdown, código ou texto adicional. Apenas o JSON puro.
  `.trim();
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });
  
  let content = response.choices[0].message.content.trim();
  
  // Remover markdown se presente
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  const questaoData = JSON.parse(content);
  
  return {
    disciplina_id: disciplina.id,
    enunciado: questaoData.enunciado,
    alternativas: questaoData.alternativas,
    resposta_correta: questaoData.resposta_correta,
    explicacao: questaoData.explicacao,
    dificuldade: dificuldade,
    fonte: 'ia_automatica',
    ativo: true
  };
}

module.exports = { addToQueue, getJobStatus };