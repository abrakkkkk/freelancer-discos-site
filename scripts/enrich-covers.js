/**
 * enrich-covers.js
 * Varre os discos das Caixas 49, 50 e 51 no Supabase,
 * busca capas em alta resolução no iTunes e Discogs,
 * grava a URL da capa diretamente no Supabase e atualiza data/discos.json.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://zolsuwuysexvnjomevvv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbHN1d3V5c2V4dm5qb21ldnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODY5MjUsImV4cCI6MjEwMTk2MjkyNX0.zhX-Cuynn9coyPwq3Qh-SfnGNQWUalvBRRlqx-bBC3E';
const DISCOGS_KEY = 'VbtfLsTsxWeeyMVswsor';
const DISCOGS_SECRET = 'HUSzibZXadHntmghPQeHCPgUjNaiTmDB';

const OUTPUT_FILE = path.resolve(__dirname, '../data/discos.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchSupabase(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, SUPABASE_URL);
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    };

    const req = https.request(u, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function searchiTunes(artista, titulo) {
  return new Promise((resolve) => {
    const q = `${artista} ${titulo}`.trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=1`;
    const req = https.get(url, { headers: { 'User-Agent': 'FreelancerDiscos/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const first = json.results?.[0];
          if (first && first.artworkUrl100) {
            resolve(first.artworkUrl100.replace('100x100bb', '600x600bb'));
            return;
          }
        } catch (_) {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function searchDiscogs(artista, titulo) {
  return new Promise((resolve) => {
    if (!DISCOGS_KEY || !DISCOGS_SECRET) return resolve(null);
    const q = `${artista} ${titulo}`.trim();
    const url = `https://api.discogs.com/database/search?type=release&per_page=1&q=${encodeURIComponent(q)}`;
    const req = https.get(url, {
      headers: {
        'Authorization': `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}`,
        'User-Agent': 'FreelancerDiscosSite/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const first = json.results?.[0];
          resolve(first?.cover_image || first?.thumb || null);
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(6000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function updateSupabaseCover(id, coverUrl) {
  return await fetchSupabase(`/rest/v1/discos?id=eq.${id}`, {
    method: 'PATCH',
    body: { capa_url: coverUrl }
  });
}

async function main() {
  console.log('📦 Buscando acervo ativo das Caixas 49, 50 e 51 no Supabase...');
  const queryUrl = '/rest/v1/discos?select=id,artista,titulo,preco,caixa,ano,observacao,capa_url&caixa=in.(49,50,51,Caixa%2049,Caixa%2050,Caixa%2051)&deletado=eq.false&ativo=eq.true&order=artista.asc';
  
  const res = await fetchSupabase(queryUrl);
  if (!res.data || !Array.isArray(res.data)) {
    throw new Error('Falha ao listar discos do Supabase: ' + JSON.stringify(res));
  }

  const records = res.data;
  console.log(`✅ ${records.length} discos carregados.`);

  const missing = records.filter(r => !r.capa_url || r.capa_url.trim().length === 0);
  console.log(`🔍 Discos sem capa identificados: ${missing.length}`);
  console.log(`🖼️ Discos com capa pré-existente: ${records.length - missing.length}`);

  let updatedCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    if (item.capa_url && item.capa_url.trim().length > 0) {
      continue;
    }

    const artistClean = (item.artista || '').trim();
    const titleClean = (item.titulo || '').trim();

    process.stdout.write(`[${i + 1}/${records.length}] ${artistClean} - ${titleClean}: `);

    // 1. Tenta iTunes (rápido, HD)
    let cover = await searchiTunes(artistClean, titleClean);
    let source = 'iTunes';

    // 2. Fallback Discogs se iTunes não achar
    if (!cover) {
      await sleep(500);
      cover = await searchDiscogs(artistClean, titleClean);
      source = 'Discogs';
      await sleep(1000); // Respeita rate-limit do Discogs
    } else {
      await sleep(250); // Intervalo suave iTunes
    }

    if (cover) {
      console.log(`✓ Encontrada (${source})`);
      item.capa_url = cover;
      await updateSupabaseCover(item.id, cover);
      updatedCount++;
    } else {
      console.log('✗ Não encontrada');
      notFoundCount++;
    }
  }

  console.log(`\n🎉 Processamento concluído!`);
  console.log(`Novas capas salvas no Supabase: ${updatedCount}`);
  console.log(`Sem capa encontrada: ${notFoundCount}`);
  const totalWithCovers = records.filter(r => r.capa_url).length;
  console.log(`Total de capas prontas no catálogo: ${totalWithCovers} de ${records.length} (${Math.round(totalWithCovers / records.length * 100)}%)`);

  // Formata e salva no data/discos.json
  const formattedForJson = records.map((item, idx) => {
    let caixaNum = item.caixa ? String(item.caixa).replace(/\D/g, '') : '50';
    if (!caixaNum) caixaNum = '50';

    return {
      id: item.id,
      numero: idx + 1,
      artista: (item.artista || 'Artista Desconhecido').trim(),
      titulo: (item.titulo || 'Sem Título').trim(),
      preco: Number(item.preco) || 0,
      caixa: `Caixa ${caixaNum}`,
      ano: item.ano ? String(item.ano).trim() : null,
      capa_url: item.capa_url || null,
      observacao: item.observacao ? item.observacao.trim() : null
    };
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(formattedForJson, null, 2), 'utf8');
  console.log(`📁 data/discos.json atualizado com sucesso!`);
}

main().catch(console.error);
