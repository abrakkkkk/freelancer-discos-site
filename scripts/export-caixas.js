/**
 * export-caixas.js
 * Script para extrair os discos das Caixas 50 e 51 do Supabase,
 * enriquecer com capas reais via Discogs API e gerar data/discos.json.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://zolsuwuysexvnjomevvv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbHN1d3V5c2V4dm5qb21ldnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODY5MjUsImV4cCI6MjEwMTk2MjkyNX0.zhX-Cuynn9coyPwq3Qh-SfnGNQWUalvBRRlqx-bBC3E';
const DISCOGS_KEY = 'VbtfLsTsxWeeyMVswsor';
const DISCOGS_SECRET = 'HUSzibZXadHntmghPQeHCPgUjNaiTmDB';

const MAIN_PROJECT_CACHE = path.resolve(__dirname, '../../src/data/covers_cache.json');
const OUTPUT_FILE = path.resolve(__dirname, '../data/discos.json');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchDiscogsCover(artista, titulo) {
  if (!DISCOGS_KEY || !DISCOGS_SECRET) return null;
  const q = `${artista} ${titulo}`.trim();
  const url = `https://api.discogs.com/database/search?type=release&per_page=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}`,
        'User-Agent': 'FreelancerDiscosSite/1.0'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const first = data.results?.[0];
      return first?.cover_image || first?.thumb || null;
    }
  } catch (err) {
    // Silencioso em caso de falha de rede
  }
  return null;
}

async function main() {
  console.log('📦 Conectando ao Supabase para buscar discos das Caixas 50 e 51...');
  
  const queryUrl = `${SUPABASE_URL}/rest/v1/discos?select=id,artista,titulo,preco,caixa,ano,observacao&caixa=in.(50,51,Caixa%2050,Caixa%2051)&deletado=eq.false&order=artista.asc`;
  
  const response = await fetch(queryUrl, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept-Profile': 'public'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao consultar Supabase: ${response.status} ${response.statusText}`);
  }

  const records = await response.json();
  console.log(`✅ ${records.length} discos encontrados no banco.`);

  // Carrega cache de capas
  let coverCache = {};
  if (fs.existsSync(MAIN_PROJECT_CACHE)) {
    try {
      coverCache = JSON.parse(fs.readFileSync(MAIN_PROJECT_CACHE, 'utf8'));
    } catch (_) {}
  }

  console.log('🔍 Enriquecendo discos com capas (Discogs)...');
  const discos = [];
  let discogsFetches = 0;
  const MAX_DISCOGS_FETCHES = 35; // Busca capas para os primeiros 35 itens para não esgotar rate-limit na primeira execução

  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    const idKey = String(item.id);
    const qKey = `${item.artista || ''} ${item.titulo || ''}`.trim().toLowerCase();
    
    let capa = coverCache[idKey]?.cover || coverCache[qKey]?.cover || null;

    if (!capa && discogsFetches < MAX_DISCOGS_FETCHES) {
      process.stdout.write(`  [${i + 1}/${records.length}] Buscando capa: ${item.artista} - ${item.titulo}... `);
      capa = await fetchDiscogsCover(item.artista, item.titulo);
      if (capa) {
        console.log('OK!');
        coverCache[qKey] = { cover: capa };
        coverCache[idKey] = { cover: capa };
      } else {
        console.log('não encontrada.');
      }
      discogsFetches++;
      await sleep(1100); // 1.1s de intervalo para respeitar o rate-limit do Discogs (60/min)
    }

    let caixaNum = item.caixa ? String(item.caixa).replace(/\D/g, '') : '50';
    if (!caixaNum) caixaNum = '50';

    discos.push({
      id: item.id,
      numero: i + 1,
      artista: (item.artista || 'Artista Desconhecido').trim(),
      titulo: (item.titulo || 'Sem Título').trim(),
      preco: Number(item.preco) || 0,
      caixa: `Caixa ${caixaNum}`,
      ano: item.ano ? String(item.ano).trim() : null,
      capa_url: capa,
      observacao: item.observacao ? item.observacao.trim() : null
    });
  }

  // Atualiza cache de capas principal se adicionamos novas
  try {
    fs.writeFileSync(MAIN_PROJECT_CACHE, JSON.stringify(coverCache, null, 2), 'utf8');
  } catch (_) {}

  // Salva no data/discos.json
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(discos, null, 2), 'utf8');
  console.log(`\n🎉 Sucesso! ${discos.length} discos salvos em: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('❌ Erro durante exportação:', err);
  process.exit(1);
});
