const { OpenAI } = require('openai');
const axios = require('axios');

// Inicializar OpenAI apenas se a chave existir
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Variável para armazenar notificações em memória (em produção, usar banco de dados)
const notifications = new Map();

// Função para limpar notificações antigas
async function cleanupNotifications() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let deletedCount = 0;
    for (const [id, notification] of notifications.entries()) {
      if (new Date(notification.createdAt) < thirtyDaysAgo) {
        notifications.delete(id);
        deletedCount++;
      }
    }
    
    console.log(`🧹 Limpeza concluída: ${deletedCount} notificações antigas removidas`);
    return deletedCount;
  } catch (error) {
    console.error('Erro na limpeza de notificações:', error);
    throw error;
  }
}

// Função para atualizar notificação no frontend
async function updateNotification(jobId, data) {
  try {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      console.log('⚠️  FRONTEND_URL não configurada, notificação não enviada');
      return;
    }

    const notification = {
      id: jobId,
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    // Armazenar em memória
    notifications.set(jobId, notification);
    
    // Enviar para o frontend (se possível)
    try {
      await axios.post(`${frontendUrl}/api/notifications`, notification, {
        headers: {
          'x-shared-secret': process.env.BASE44_SHARED_SECRET
        },
        timeout: 5000
      });
      console.log(`📤 Notificação ${jobId} enviada para o frontend`);
    } catch (error) {
      console.log(`📋 Notificação ${jobId} armazenada localmente (frontend offline)`);
    }
    
    return notification;
  } catch (error) {
    console.error('Erro ao atualizar notificação:', error);
  }
}

// Função principal para gerar questões
async function generateQuestions(jobData) {
  const { jobId, estudoId, disciplinas, configuracoes } = jobData;
  
  console.log(`🎯 Iniciando geração de questões para job ${jobId}`);
  console.log(`📚 Matérias: ${disciplinas.join(', ')}`);
  console.log(`⚙️  Configurações:`, configuracoes);

  try {
    // Atualizar status para iniciado
    await updateNotification(jobId, {
      type: 'QUESTION_GENERATION',
      status: 'IN_PROGRESS',
      progress: 0,
      message: 'Iniciando geração de questões...',
      estudoId,
      createdAt: new Date().toISOString()
    });

    const allQuestions = [];
    const totalQuestoes = configuracoes.quantidadeQuestoes;
    const questoesPorMateria = Math.floor(totalQuestoes / disciplinas.length);
    const questoesExtras = totalQuestoes % disciplinas.length;

    // Processar cada matéria
    for (let i = 0; i < disciplinas.length; i++) {
      const materia = disciplinas[i];
      const questoesMateria = questoesPorMateria + (i < questoesExtras ? 1 : 0);
      
      console.log(`📖 Processando ${materia}: ${questoesMateria} questões`);
      
      // Atualizar progresso
      const progresso = Math.round(((i + 1) / disciplinas.length) * 100);
      await updateNotification(jobId, {
        status: 'IN_PROGRESS',
        progress: progresso,
        message: `Processando ${materia}... (${i + 1}/${disciplinas.length})`,
        currentMateria: materia
      });

      // Gerar questões para esta matéria em lotes
      const materiaQuestions = await generateQuestionsForMateria(
        materia, 
        questoesMateria, 
        configuracoes
      );
      
      allQuestions.push(...materiaQuestions);
    }

    // Salvar questões no banco através do proxy
    console.log(`💾 Salvando ${allQuestions.length} questões no banco...`);
    
    await updateNotification(jobId, {
      status: 'SAVING',
      progress: 95,
      message: 'Salvando questões no banco de dados...'
    });

    // Enviar questões para o frontend salvar
    try {
      const response = await axios.post(
        `${process.env.FRONTEND_URL}/api/questions/bulk`,
        {
          estudoId,
          questoes: allQuestions
        },
        {
          headers: {
            'x-shared-secret': process.env.BASE44_SHARED_SECRET,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log(`✅ Questões salvas com sucesso:`, response.data);
      
      // Notificar sucesso
      await updateNotification(jobId, {
        status: 'COMPLETED',
        progress: 100,
        message: `Geração concluída! ${allQuestions.length} questões criadas.`,
        questoesGeradas: allQuestions.length,
        completedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erro ao salvar questões:', error.response?.data || error.message);
      throw new Error(`Erro ao salvar questões: ${error.response?.data?.error || error.message}`);
    }

  } catch (error) {
    console.error(`❌ Erro na geração de questões para job ${jobId}:`, error);
    
    // Notificar erro
    await updateNotification(jobId, {
      status: 'FAILED',
      progress: 0,
      message: `Erro: ${error.message}`,
      error: error.message,
      failedAt: new Date().toISOString()
    });
    
    throw error;
  }
}

// Função para gerar questões para uma matéria específica
async function generateQuestionsForMateria(materia, quantidade, configuracoes) {
  const questions = [];
  const questoesPorLote = 10; // Processar de 10 em 10 para não sobrecarregar a API
  
  for (let i = 0; i < quantidade; i += questoesPorLote) {
    const questoesLote = Math.min(questoesPorLote, quantidade - i);
    
    const prompt = createPrompt(materia, questoesLote, configuracoes);
    
    try {
      console.log(`🤖 Gerando lote de ${questoesLote} questões para ${materia}...`);
      
      // Verificar se OpenAI está configurado
      if (!openai) {
        console.log(`⚠️  OpenAI não configurado. Criando questões de exemplo para ${materia}`);
        const loteQuestions = createSampleQuestions(materia, questoesLote);
        console.log(`✅ Lote de exemplo criado: ${loteQuestions.length} questões`);
        questions.push(...loteQuestions);
        continue;
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Você é um professor experiente especializado em criar questões educacionais de alta qualidade."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      const generatedText = response.choices[0].message.content;
      const loteQuestions = parseQuestions(generatedText, materia);
      
      console.log(`✅ Lote gerado: ${loteQuestions.length} questões`);
      questions.push(...loteQuestions);
      
      // Pequena pausa entre requisições para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Erro ao gerar questões para ${materia}:`, error);
      // Em caso de erro, criar questões de exemplo
      console.log(`⚠️  Criando questões de exemplo devido ao erro`);
      const loteQuestions = createSampleQuestions(materia, questoesLote);
      questions.push(...loteQuestions);
    }
  }
  
  return questions;
}

// Função para criar o prompt para o GPT-4
function createPrompt(materia, quantidade, configuracoes) {
  const { nivelDificuldade, tiposQuestoes } = configuracoes;
  
  const dificuldadeText = {
    'facil': 'fáceis',
    'medio': 'médias',
    'dificil': 'difíceis',
    'misto': 'variadas (fáceis, médias e difíceis)'
  }[nivelDificuldade] || 'médias';

  let prompt = `Crie exatamente ${quantidade} questões de múltipla escolha SOBRE: ${materia}

REGRAS IMPORTANTES:
1. Cada questão DEVE ter: enunciado, 4 alternativas (A, B, C, D), e resposta correta
2. As questões devem ser ${dificuldadeText}
3. O conteúdo deve ser educacional e apropriado para estudos
4. Use linguagem clara e objetiva
5. Evite repetir questões ou conteúdos idênticos

FORMATO OBRIGATÓRIO (uma questão por bloco):
---
QUESTÃO X
Enunciado da questão aqui?
A) Alternativa A
B) Alternativa B
C) Alternativa C
D) Alternativa D
RESPOSTA: X
---

Substitua X pelo número da questão e pela letra correta (A, B, C ou D).

Gere exatamente ${quantidade} questões seguindo este formato.`;

  if (tiposQuestoes && tiposQuestoes.length > 0) {
    prompt += `\n\nTIPOS DE QUESTÕES PERMITIDOS: ${tiposQuestoes.join(', ')}`;
  }

  return prompt;
}

// Função para parsear as questões geradas
function parseQuestions(text, materia) {
  const questions = [];
  const blocks = text.split('---').filter(block => block.trim());
  
  blocks.forEach((block, index) => {
    try {
      const lines = block.split('\n').filter(line => line.trim());
      
      // Encontrar o número da questão
      const numeroMatch = lines[0].match(/QUESTÃO (\d+)/i);
      const numero = numeroMatch ? parseInt(numeroMatch[1]) : index + 1;
      
      // Encontrar o enunciado (linhas até a primeira alternativa)
      let enunciado = '';
      let alternativaStart = -1;
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].match(/^[A-D]\)/)) {
          alternativaStart = i;
          break;
        }
        enunciado += lines[i] + ' ';
      }
      
      enunciado = enunciado.trim();
      
      // Extrair alternativas
      const alternativas = {};
      let respostaCorreta = '';
      
      for (let i = alternativaStart; i < lines.length; i++) {
        const alternativaMatch = lines[i].match(/^([A-D])\) (.+)$/);
        if (alternativaMatch) {
          alternativas[alternativaMatch[1]] = alternativaMatch[2].trim();
        }
        
        // Encontrar resposta correta
        const respostaMatch = lines[i].match(/RESPOSTA:\s*([A-D])/i);
        if (respostaMatch) {
          respostaCorreta = respostaMatch[1];
        }
      }
      
      if (enunciado && Object.keys(alternativas).length === 4 && respostaCorreta) {
        questions.push({
          enunciado,
          alternativas,
          respostaCorreta,
          materia,
          dificuldade: 'medio', // Padrão, pode ser ajustado
          tipo: 'multipla_escolha',
          createdAt: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Erro ao parsear bloco:', block, error);
    }
  });
  
  return questions;
}

// Função para criar questões de exemplo quando OpenAI não está disponível
function createSampleQuestions(materia, quantidade) {
  const sampleQuestions = [];
  const templates = [
    {
      enunciado: `Qual é o principal conceito estudado em ${materia}?`,
      alternativas: {
        'A': 'Conceito fundamental da área',
        'B': 'Um conceito secundário',
        'C': 'Uma aplicação prática',
        'D': 'Um exemplo específico'
      },
      respostaCorreta: 'A'
    },
    {
      enunciado: `Sobre ${materia}, qual afirmação está correta?`,
      alternativas: {
        'A': 'É uma área importante do conhecimento',
        'B': 'Não tem relevância prática',
        'C': 'É apenas teórica',
        'D': 'Não possui aplicações'
      },
      respostaCorreta: 'A'
    },
    {
      enunciado: `O que caracteriza o estudo de ${materia}?`,
      alternativas: {
        'A': 'Sua abordagem metodológica específica',
        'B': 'Falta de metodologia',
        'C': 'Apenas aspectos teóricos',
        'D': 'Nenhuma das alternativas'
      },
      respostaCorreta: 'A'
    }
  ];

  for (let i = 0; i < quantidade; i++) {
    const template = templates[i % templates.length];
    sampleQuestions.push({
      ...template,
      materia,
      dificuldade: 'medio',
      tipo: 'multipla_escolha',
      createdAt: new Date().toISOString()
    });
  }

  return sampleQuestions;
}

module.exports = {
  generateQuestions,
  cleanupNotifications
};