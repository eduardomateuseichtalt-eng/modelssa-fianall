# Model's S.A - Bootstrap

## Requisitos
- Docker & docker-compose
- Node >= 18 (opcional para rodar local npm)

## Rodando em desenvolvimento
1. Copie `.env.example` para `.env` e ajuste variáveis conforme necessário.
2. No diretório raiz:
   docker-compose up --build

3. Frontend:
   http://localhost:3000

4. Backend:
   http://localhost:4000/health

## Estrutura
- backend/  -> API (Node + TypeScript)
- frontend/ -> App React (Vite)
- db/ -> Postgres (via container)
- minio/ -> armazenamento S3 local

## SMS
- Configure as credenciais da Twilio no `.env` para habilitar envio de codigos.
 