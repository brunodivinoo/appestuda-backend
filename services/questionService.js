const OpenAI = require('openai');
const axios = require('axios');

const BASE44_API = 'https://base44.app/api/apps/6910a14f39e954f56162a6e3';
const SHARED_SECRET = process.env.BASE44_SHARED_SECRET;

const api = axios.create({
  baseURL: BASE44_API,
  headers: {
    'x-shared-secret': SHARED_SECRET,
    'Content-Type': 'application/json'
  },
  timeout: 120000
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function gerarQuestoesIA(params) {
  const {
    jobId,
    estudoId,
    disciplinas,
    assuntos,
    configuracoes,
    userEmail
  } = params;

  const quantidade = configuracoes.quantidade || configuracoes.quantidadeQuestoes || 10;

  console.log(`[${jobId}] 🎯 Iniciando geração de ${quantidade} questões`);

  try {
    // 1. Buscar disciplinas completas
    const disciplinasCompletas = [];
    for (const discId of disciplinas) {
      const { data } = await api.get(`/entities/Disciplina/${discId}`);
      disciplinasCompletas.push(data);
    }

    // 2. Buscar assuntos completos
    const assuntosCompletos = {};
    for (const [key, ids] of Object.entries(assuntos)) {
      if (ids && ids.length > 0) {
        assuntosCompletos[key] = [];
        for (const assuntoId of ids) {
          const { data } = await api.get(`/entities/Disciplina/${assuntoId}`);
          assuntosCompletos[key].push(data);
        }
      }
    }

    // 3. Montar contexto
    const contexto = disciplinasCompletas.map(d => {
      const assuntosTexto = (assuntosCompletos[d.id] || [])
        .map(a => `  - ${a.titulo}`)
        .join("\n");
      
      return `Disciplina: ${d.titulo}${assuntosTexto ? '\n' + assuntosTexto : ''}`;
    }).join("\n\n");

    console.log(`[${jobId}] 📚 Contexto:\n${contexto}`);

    // 4. Formato de alternativas
    const formatoAlternativas = configuracoes.modalidade === "certo_errado"
      ? `[{"letra": "C", "texto": "Certo", "correta": true}, {"letra": "E", "texto": "Errado", "correta": false}]`
      : `[{"letra": "A", "texto": "...", "correta": false}, {"letra": "B", "texto": "...", "correta": true}, {"letra": "C", "texto": "...", "correta": false}, {"letra": "D", "texto": "...", "correta": false}, {"letra": "E", "texto": "...", "correta": false}]`;

    // 5. Prompt base
    const promptBase = `Você é um gerador especializado de questões de concurso público${configuracoes.banca ? ` no estilo ${configuracoes.banca}` : ''}.

CONTEXTO DO ESTUDO:
${contexto}

INSTRUÇÕES:
- Gere questões ${configuracoes.modalidade === "certo_errado" ? "de CERTO ou ERRADO" : "de MÚLTIPLA ESCOLHA"}
${configuracoes.banca ? `- Banca: ${configuracoes.banca}` : '- Banca: Aleatória (CESPE, FGV, VUNESP, FCC, etc)'}
${configuracoes.ano ? `- Ano: ${configuracoes.ano}` : '- Ano: Aleatório (2020-2024)'}
- Nível de escolaridade: ${configuracoes.nivel}
- Dificuldade: ${configuracoes.dificuldade}
${configuracoes.modalidade === "multipla_escolha" ? '- Cada questão deve ter EXATAMENTE 5 alternativas (A, B, C, D, E)' : '- Cada questão deve ter EXATAMENTE 2 alternativas (Certo ou Errado)'}
- Apenas UMA alternativa correta por questão
- Inclua explicação DETALHADA da resposta correta
- As questões devem ser realistas e seguir o padrão de concursos públicos
- Distribua as questões entre as disciplinas e assuntos fornecidos

FORMATO JSON (RETORNE APENAS JSON VÁLIDO, SEM MARKDOWN):
[
  {
    "enunciado": "Texto completo da questão aqui...",
    "alternativas": ${formatoAlternativas},
    "gabarito": "${configuracoes.modalidade === "certo_errado" ? 'C ou E' : 'letra da alternativa correta'}",
    "explicacao": "Explicação detalhada e didática da resposta correta...",
    "disciplina_titulo": "Nome exato da disciplina",
    "assunto_titulo": "Nome exato do assunto (se aplicável)"
  }
]`;

    // 6. Gerar em lotes de 10
    const totalLotes = Math.ceil(quantidade / 10);
    let questoesCriadas = 0;

    for (let lote = 0; lote < totalLotes; lote++) {
      const quantidadeLote = Math.min(10, quantidade - questoesCriadas);
      
      console.log(`[${jobId}] 📝 Gerando lote ${lote + 1}/${totalLotes} (${quantidadeLote} questões)`);

      const promptLote = `${promptBase}\n\nGere exatamente ${quantidadeLote} questões.`;

      // Chamar OpenAI GPT-4
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{
          role: "user",
          content: promptLote
        }],
        temperature: 0.7,
        max_tokens: 4000
      });

      const conteudo = response.choices[0].message.content;
      
      // Limpar markdown
      const jsonLimpo = conteudo
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      let questoesLote;
      try {
        questoesLote = JSON.parse(jsonLimpo);
      } catch (parseError) {
        console.error(`[${jobId}] ❌ Erro ao parsear JSON:`, jsonLimpo.substring(0, 200));
        throw new Error("Resposta da IA não está em formato JSON válido");
      }

      // Salvar questões no Base44
      for (const q of questoesLote) {
        try {
          // Encontrar disciplina
          const disciplina = disciplinasCompletas.find(
            d => d.titulo.toLowerCase() === q.disciplina_titulo.toLowerCase()
          );
          
          // Encontrar assunto (se houver)
          let assuntoId = null;
          if (q.assunto_titulo) {
            const todosAssuntos = Object.values(assuntosCompletos).flat();
            const assunto = todosAssuntos.find(
              a => a.titulo.toLowerCase() === q.assunto_titulo.toLowerCase()
            );
            assuntoId = assunto?.id || null;
          }

          // Criar questão via Base44 API
          await api.post('/entities/Questao', {
            enunciado: q.enunciado,
            alternativas: q.alternativas,
            gabarito: q.gabarito,
            explicacao: q.explicacao,
            estudo_id: estudoId,
            disciplina_id: disciplina?.id,
            assunto_id: assuntoId,
            banca: configuracoes.banca || "Aleatória",
            ano: configuracoes.ano ? parseInt(configuracoes.ano) : null,
            nivel: configuracoes.nivel,
            nivel_dificuldade: configuracoes.dificuldade,
            modalidade: configuracoes.modalidade,
            fonte: "ia_automatica",
            privada: true,
            ativo: true,
            vezes_resolvida: 0,
            vezes_acertada: 0,
            taxa_acerto: 0,
            created_by: userEmail,
          });

          questoesCriadas++;

          // Atualizar progresso na notificação
          const progresso = Math.round((questoesCriadas / quantidade) * 100);
          
          await api.patch(`/entities/NotificacaoGeracaoQuestao/${jobId}`, {
            total_gerado: questoesCriadas,
            progresso: progresso,
          });

          console.log(`[${jobId}] ✅ Progresso: ${questoesCriadas}/${quantidade} (${progresso}%)`);

        } catch (saveError) {
          console.error(`[${jobId}] ❌ Erro ao salvar questão:`, saveError.message);
        }
      }

      // Delay entre lotes
      if (lote < totalLotes - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 7. Finalizar
    await api.patch(`/entities/NotificacaoGeracaoQuestao/${jobId}`, {
      status: "concluida",
      total_gerado: questoesCriadas,
      progresso: 100,
    });

    console.log(`[${jobId}] 🎉 Geração concluída! Total: ${questoesCriadas} questões`);

    return {
      success: true,
      total: questoesCriadas
    };

  } catch (error) {
    console.error(`[${jobId}] ❌ Erro na geração:`, error.message);
    
    // Atualizar notificação com erro
    try {
      await api.patch(`/entities/NotificacaoGeracaoQuestao/${jobId}`, {
        status: "erro",
        erro_mensagem: error.message,
      });
    } catch (updateError) {
      console.error(`[${jobId}] ❌ Erro ao atualizar notificação:`, updateError);
    }

    throw error;
  }
}

async function limparNotificacoesAntigas() {
  console.log('🧹 Limpando notificações antigas...');

  try {
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const { data: notificacoes } = await api.get('/entities/NotificacaoGeracaoQuestao', {
      params: {
        filter: JSON.stringify({
          created_date: { $lt: trintaDiasAtras.toISOString() }
        })
      }
    });

    let deletadas = 0;
    for (const notif of notificacoes) {
      try {
        await api.delete(`/entities/NotificacaoGeracaoQuestao/${notif.id}`);
        deletadas++;
      } catch (deleteError) {
        console.error(`❌ Erro ao deletar notificação ${notif.id}:`, deleteError.message);
      }
    }

    console.log(`✅ ${deletadas} notificações antigas deletadas`);

    return { deletadas };

  } catch (error) {
    console.error('❌ Erro ao limpar notificações:', error.message);
    throw error;
  }
}

module.exports = {
  gerarQuestoesIA,
  limparNotificacoesAntigas
};