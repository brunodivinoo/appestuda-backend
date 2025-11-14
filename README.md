# AppEstuda Backend

Backend Node.js para gerenciar cron jobs, automações e geração de questões do AppEstuda.

## 🚀 Features

- ✅ Finalização automática de sessões expiradas
- ✅ Finalização automática de desafios expirados
- ✅ Criação automática de desafios (diário/semanal/mensal)
- ✅ Geração de questões com IA (OpenAI GPT-4)
- ✅ Fila de processamento (Bull + Redis)

## 📋 Requisitos

- Node.js >= 18.0.0
- Redis (para fila de questões)
- Conta OpenAI (API Key)
- Token Base44 API

## 🔧 Instalação
```bash
npm install
```

## ⚙️ Configuração

Copie `.env.example` para `.env` e preencha as variáveis:
```bash
cp .env.example .env
```

## 🏃 Execução
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 📡 Endpoints

### Health Check
```
GET /
GET /health
```

### Cron Jobs (autenticação requerida)
```
POST /cron/finalize-sessions
POST /cron/finalize-challenges
POST /cron/create-daily-challenges
POST /cron/create-weekly-challenges
POST /cron/create-monthly-challenges
```

### Questões (Fase 7)
```
POST /questions/generate
GET /questions/status/:job_id
```

## 🔐 Autenticação

Cron jobs requerem header `x-cron-token` com o valor do `CRON_SECRET_TOKEN`.

## 📦 Deploy

Deploy no Railway:
1. Conecte o repositório GitHub
2. Configure variáveis de ambiente
3. Deploy automático

## 📝 Licença

Propriedade de Escala One