const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool, types } = require("pg");

// O driver do Postgres devolve colunas "numeric" como texto (para não perder
// precisão). Isso fazia o valor recuperado virar string e quebrar as somas em
// reais no painel (ex: 0 + "1935.00" virava o texto "01935.00" em vez de somar).
// Aqui forçamos a conversão para número sempre que o Postgres devolver um
// campo numeric (OID 1700).
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

const app = express();
const PORT = process.env.PORT || 3001;
const SENHA = process.env.SENHA_PAINEL || "tenda123@";
const DB_FILE = path.join(__dirname, "dados.json");

const DATABASE_URL = process.env.DATABASE_URL;
const USANDO_POSTGRES = Boolean(DATABASE_URL);

const pool = USANDO_POSTGRES
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

async function iniciarBanco() {
  if (!USANDO_POSTGRES) {
    console.log(
      "Armazenamento: arquivo local dados.json (defina DATABASE_URL para usar Postgres persistente)"
    );
    return;
  }
  await pool.query(`
    create table if not exists ocorrencias (
      id text primary key,
      data date not null,
      loja text not null,
      regional text default '',
      descricao text not null,
      "valorRecuperado" numeric default 0,
      quadrilha boolean default false,
      nome text default '',
      inibido boolean default false,
      "apoioCopia" boolean default false,
      monitoramento boolean default false,
      "criadoEm" timestamptz default now()
    )
  `);
  await pool.query(`
    alter table ocorrencias add column if not exists regional text default ''
  `);
  await pool.query(`
    alter table ocorrencias add column if not exists nome text default ''
  `);
  await pool.query(`
    alter table ocorrencias add column if not exists inibido boolean default false
  `);
  await pool.query(`
    alter table ocorrencias add column if not exists "apoioCopia" boolean default false
  `);
  await pool.query(`
    alter table ocorrencias add column if not exists monitoramento boolean default false
  `);
  await pool.query(`
    alter table ocorrencias add column if not exists foto text
  `);
  console.log("Armazenamento: Postgres (persistente)");
}

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Fallback local (arquivo JSON) ----------
function lerDadosArquivo() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function salvarDadosArquivo(dados) {
  fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));
}

// ---------- Camada de dados (Postgres ou arquivo) ----------
async function listarOcorrencias() {
  if (USANDO_POSTGRES) {
    const { rows } = await pool.query(
      'select * from ocorrencias order by "criadoEm" desc'
    );
    // Segunda camada de proteção: garante numero mesmo se o typeParser
    // acima não pegar (ex: coluna vindo de outro tipo/consulta).
    return rows.map((r) => ({
      ...r,
      valorRecuperado: Number(r.valorRecuperado) || 0,
    }));
  }
  return lerDadosArquivo().map((r) => ({
    ...r,
    valorRecuperado: Number(r.valorRecuperado) || 0,
  }));
}

async function criarOcorrencia(campos) {
  const nova = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    data: campos.data,
    loja: campos.loja,
    regional: campos.regional || "",
    descricao: campos.descricao,
    valorRecuperado: Number(campos.valorRecuperado) || 0,
    quadrilha: !!campos.quadrilha,
    nome: campos.nome || "",
    inibido: !!campos.inibido,
    apoioCopia: !!campos.apoioCopia,
    monitoramento: !!campos.monitoramento,
    foto: campos.foto || null,
    criadoEm: new Date().toISOString(),
  };

  if (USANDO_POSTGRES) {
    await pool.query(
      `insert into ocorrencias (id, data, loja, regional, descricao, "valorRecuperado", quadrilha, nome, inibido, "apoioCopia", monitoramento, foto, "criadoEm")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        nova.id,
        nova.data,
        nova.loja,
        nova.regional,
        nova.descricao,
        nova.valorRecuperado,
        nova.quadrilha,
        nova.nome,
        nova.inibido,
        nova.apoioCopia,
        nova.monitoramento,
        nova.foto,
        nova.criadoEm,
      ]
    );
    return nova;
  }

  const dados = lerDadosArquivo();
  dados.unshift(nova);
  salvarDadosArquivo(dados);
  return nova;
}

async function excluirOcorrencia(id) {
  if (USANDO_POSTGRES) {
    await pool.query("delete from ocorrencias where id = $1", [id]);
    return;
  }
  const dados = lerDadosArquivo();
  const restante = dados.filter((o) => o.id !== id);
  salvarDadosArquivo(restante);
}

// ---------- Autenticacao simples por senha compartilhada ----------
function checarSenha(req, res, next) {
  const senha = req.headers["x-senha"];
  if (senha !== SENHA) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }
  next();
}

app.post("/api/login", (req, res) => {
  const { senha } = req.body;
  if (senha === SENHA) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, erro: "Senha incorreta" });
});

app.get("/api/ocorrencias", checarSenha, async (req, res) => {
  try {
    const dados = await listarOcorrencias();
    res.json(dados);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao ler os dados" });
  }
});

app.post("/api/ocorrencias", checarSenha, async (req, res) => {
  const { data, loja, regional, descricao, valorRecuperado, quadrilha, nome, inibido, apoioCopia, monitoramento, foto } = req.body;
  if (!data || !loja || !descricao || !nome) {
    return res.status(400).json({ erro: "Preencha nome, data, loja e descricao" });
  }
  try {
    const nova = await criarOcorrencia({
      data,
      loja,
      regional,
      descricao,
      valorRecuperado,
      quadrilha,
      nome,
      inibido,
      apoioCopia,
      monitoramento,
      foto,
    });
    res.status(201).json(nova);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao salvar os dados" });
  }
});

app.delete("/api/ocorrencias/:id", checarSenha, async (req, res) => {
  try {
    await excluirOcorrencia(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao excluir" });
  }
});

iniciarBanco()
  .catch((e) => {
    console.error("Erro ao iniciar banco:", e);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Painel Tenda Atacado rodando na porta ${PORT}`);
    });
  });
