/* ==========================================================================
   migrations.js — migrações de dados versionadas, ADITIVAS e reversíveis.

   Regras do projeto:
   1. Uma migração nunca apaga nem renomeia campos existentes; só acrescenta
      campos novos com valores padrão (por isso desfazer = ignorar os novos).
   2. Antes de rodar qualquer migração, um snapshot completo é guardado no
      IndexedDB (backup.js) — restaurável em Configurações → Dados.
   3. Os módulos normalizam os registros EM MEMÓRIA ao ler (ver normalizeXxx
      em cada módulo); o registro só é regravado quando o usuário edita.
   Esquema atual registrado em localStorage['chancelaria_schema'] (só local).
   ========================================================================== */
const SCHEMA_ATUAL = 1;
const MIGRACOES = [
  { versao: 1, descricao: 'Questões, cronograma, discursivas, atualidades e SRS ganham campos novos (todos opcionais).', desfazer: 'Campos novos são ignorados pelas versões antigas; snapshot pré-migração disponível.' }
];
async function migrarSeNecessario() {
  const atual = +localStorage.getItem('chancelaria_schema') || 0;
  if (atual >= SCHEMA_ATUAL) return false;
  const temDados = CLOUD_KEYS.some(k => localStorage.getItem(k) != null);
  if (temDados) await criarSnapshot('pre-migracao-schema-' + SCHEMA_ATUAL);
  localStorage.setItem('chancelaria_schema', String(SCHEMA_ATUAL));
  return true;
}
