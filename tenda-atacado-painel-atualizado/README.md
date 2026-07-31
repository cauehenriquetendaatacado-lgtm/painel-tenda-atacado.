# Painel de Ocorrências — Tenda Atacado

Aplicativo web simples (Node.js + Express) para registrar ocorrências de
roubo. Acesso protegido por senha única, compartilhada entre os
funcionários/gerentes.

## Rodar localmente

```bash
npm install
npm start
```

Acesse http://localhost:3001 — senha padrão: `tenda2026`
(pode mudar definindo a variável de ambiente `SENHA_PAINEL`).

## Colocar no GitHub

```bash
git init
git add .
git commit -m "Painel de ocorrencias - versao inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/tenda-atacado-painel.git
git push -u origin main
```

(Crie o repositório vazio antes em github.com/new — não marque "adicionar README").

## Colocar no ar (hospedagem gratuita)

O GitHub sozinho não roda o servidor — ele só guarda o código. Para o
painel ficar acessível pela internet 24h, conecte o repositório a um
serviço de hospedagem. Recomendo o **Render**:

1. Crie conta em https://render.com (dá pra logar com o GitHub).
2. "New" → "Web Service" → selecione o repositório `tenda-atacado-painel`.
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Em "Environment", adicione a variável `SENHA_PAINEL` com a senha que
   quiser usar.
5. Clique em "Create Web Service". Em alguns minutos o Render dá um link
   tipo `https://tenda-atacado-painel.onrender.com` — esse é o link que
   você compartilha com os funcionários.

## Banco de dados persistente (Postgres — gratuito)

O código já vem preparado para gravar num banco Postgres em vez do
arquivo local, usando a variável `DATABASE_URL`. A tabela é criada
automaticamente na primeira vez que o servidor sobe. Se
`DATABASE_URL` não for configurada, o app continua funcionando com
o arquivo `dados.json` (bom só para testar na sua máquina).

**Atenção:** o Postgres gratuito do próprio Render expira em 30 dias
e é apagado — não sirva para dados que não podem sumir. Recomendo o
**Neon** (Postgres serverless, plano grátis sem prazo de expiração).
O Supabase também funciona igual com esse mesmo código, caso
prefira: basta pegar a connection string Postgres dele em vez da do
Neon.

### 1. Criar o banco no Neon

1. Crie conta grátis em https://neon.tech (dá pra logar com GitHub).
2. Crie um projeto (ex: `tenda-painel`).
3. Na tela do projeto, copie a **Connection String** (algo como
   `postgresql://usuario:senha@ep-xxxx.neon.tech/neondb?sslmode=require`).

### 2. Configurar no Render

No serviço do Render, vá em **Environment** e adicione:
- `DATABASE_URL` = a connection string copiada do Neon

Salve — o Render reinicia o serviço automaticamente. No log de
deploy deve aparecer `Armazenamento: Postgres (persistente)`. A
partir daí os dados ficam guardados no banco, sobrevivendo a
reinícios e ao "sono" do plano gratuito do Render.

O plano gratuito do Neon dá 0,5 GB de armazenamento, o suficiente
para milhares de ocorrências.
