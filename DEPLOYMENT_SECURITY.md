# Configuracao segura de producao

Nunca salve valores reais de senhas, tokens ou chaves no GitHub. Cadastre-os somente nos paineis da hospedagem.

## Backend (Render)

Configure estas variaveis no servico do backend:

```env
NODE_ENV=production
PORT=4000
CORS_ALLOWED_ORIGINS=https://models-club.com,https://www.models-club.com
AUTH_COOKIE_DOMAIN=
AGE_VERIFY_COOKIE_DOMAIN=
AGE_VERIFY_COOKIE_SECURE=true
ENABLE_ADMIN_RESET=false
ENABLE_ADMIN_BOOTSTRAP=false
MODEL_REGISTER_EMAIL_OTP_REQUIRED=true
```

Cadastre valores reais e exclusivos para:

```env
DATABASE_URL=<url privada do PostgreSQL>
REDIS_URL=<url privada do Redis>
JWT_ACCESS_SECRET=<segredo aleatorio forte>
OTP_HASH_SECRET=<outro segredo aleatorio forte>
ADMIN_EMAIL=<email administrativo real>
RESEND_API_KEY=<chave real>
BUNNY_STORAGE_ZONE=<zona real>
BUNNY_STORAGE_KEY=<chave real>
BUNNY_CDN_URL=<url real do CDN>
```

Os segredos `JWT_ACCESS_SECRET` e `OTP_HASH_SECRET` devem ser diferentes. Nao use `change_me`, dados pessoais ou a senha do administrador.

Deixe `AUTH_COOKIE_DOMAIN` vazio para gerar um cookie restrito ao host da API. Use `.models-club.com` somente se houver necessidade comprovada de compartilhar o cookie entre subdominios.

As variaveis `ADMIN_RESET_KEY` e `ADMIN_KEY_RESET` nao sao necessarias enquanto as rotas administrativas de recuperacao estiverem desabilitadas.

## Frontend (Vercel)

Configure para Production:

```env
VITE_API_URL=https://api.models-club.com
```

O endereco deve apontar para o dominio HTTPS real do backend. Depois de alterar `VITE_API_URL`, publique novamente o frontend, pois o Vite grava esse valor durante o build.

## Dominios

- `models-club.com` e `www.models-club.com`: frontend.
- `api.models-club.com`: backend.
- O DNS de `api.models-club.com` deve apontar para o servico do backend.
- Nao inclua `localhost` em `CORS_ALLOWED_ORIGINS` de producao.

## Ordem de publicacao

1. Cadastre e revise as variaveis do backend.
2. Publique o backend e confirme `/api/health/db`.
3. Configure `VITE_API_URL` no Vercel.
4. Publique o frontend.
5. Apague cookies e tokens antigos do navegador ou faca login novamente.
6. Teste login, recarga da pagina, logout e uploads para modelo e administrador.

## Verificacoes finais

- O login deve responder sem expor JWT no corpo da resposta.
- O cookie `modelsClubSession` deve aparecer como `HttpOnly` e `Secure`.
- Recarregar uma pagina privada deve manter a sessao.
- O logout deve remover o cookie.
- Origens fora dos dominios autorizados devem receber bloqueio de CORS.
- PostgreSQL e Redis nao devem usar portas publicas ou credenciais padrao.
