/* 공개 명칭만 검색하는 순수 함수. 표시용 소장 정보는 입력받지 않습니다. */
(function (root) {
  'use strict';
  const statuses = ['all', 'pending', 'released', 'unverified', 'confirmed_unused', 'conflicting'];
  const sorts = ['number-asc', 'number-desc', 'title'];
  const collator = new Intl.Collator('ko', {numeric: true, sensitivity: 'base'});
  function normalize(value) {
    return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').normalize('NFC')
      .toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/gu, ' ').trim();
  }
  function safeQuery(value) {
    const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
    if (text.length > 120 || /[\x00-\x1f\x7f]|\b(?:password|api[_-]?key|access[_-]?token)\s*[=:]|\b(?:ghp_|github_pat_|sk-proj-)|[A-Za-z]:[\\/]|file:\/|[^\s]+@[^\s]+\.[^\s]+/i.test(text)) return '';
    return text;
  }
  function readState(search) {
    const params = new URLSearchParams(search);
    const rawQ = params.get('q') || '';
    const q = safeQuery(rawQ);
    const status = statuses.includes(params.get('status')) ? params.get('status') : 'all';
    const sort = sorts.includes(params.get('sort')) ? params.get('sort') : 'number-asc';
    const invalid = [...params.keys()].some(key => !['q', 'status', 'sort'].includes(key)) ||
      ['q', 'status', 'sort'].some(key => params.getAll(key).length > 1) ||
      (params.has('q') && q !== rawQ.trim().replace(/\s+/gu, ' ')) ||
      (params.has('status') && !statuses.includes(params.get('status'))) || (params.has('sort') && !sorts.includes(params.get('sort')));
    return {q, status, sort, invalid};
  }
  function serialize(state) {
    const params = new URLSearchParams();
    const q = safeQuery(state.q);
    if (q) params.set('q', q);
    if (state.status !== 'all' && statuses.includes(state.status)) params.set('status', state.status);
    if (state.sort !== 'number-asc' && sorts.includes(state.sort)) params.set('sort', state.sort);
    return params.size ? '?' + params.toString() : '';
  }
  function exactKeys(value, expected) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
  }
  function validateIndex(index, version) {
    if (!exactKeys(index, ['schema_version', 'data_version', 'catalog', 'records']) || index.schema_version !== 1 || index.data_version !== version || !Array.isArray(index.catalog) || index.catalog.length !== 100 || !Array.isArray(index.records)) throw new Error('search-format');
    const seen = new Set();
    for (let i = 0; i < index.catalog.length; i++) {
      const row = index.catalog[i];
      if (!exactKeys(row, ['key', 'number', 'release_status', 'album_key', 'title', 'artist']) || row.number !== i + 1501 || row.key !== 'blp-' + row.number ||
          ![null, 'released', 'unverified', 'confirmed_unused', 'conflicting'].includes(row.release_status) ||
          ![row.title, row.artist, row.album_key].every(value => value === null || typeof value === 'string')) throw new Error('search-format');
    }
    for (const row of index.records) {
      if (!exactKeys(row, ['key', 'kind', 'title', 'artist', 'album_titles', 'catalog_numbers', 'url']) ||
          !['album', 'musician', 'track'].includes(row.kind) || typeof row.key !== 'string' || seen.has(row.key) ||
          typeof row.title !== 'string' || typeof row.artist !== 'string' || !Array.isArray(row.album_titles) || !row.album_titles.every(x => typeof x === 'string') ||
          !Array.isArray(row.catalog_numbers) || !row.catalog_numbers.every(x => Number.isInteger(x) && x >= 1501 && x <= 1600) ||
          (row.url !== null && !/^\/bluenote\/(albums|musicians|tracks)\/[a-z][a-z0-9-]{2,79}\/$/.test(row.url))) throw new Error('search-format');
      seen.add(row.key);
    }
    return index;
  }
  function queryParts(query) {
    let q = normalize(query);
    const code = q.match(/^(?:blp[\s-]*)?(\d+)$/);
    if (code) {
      q = code[1];
      if (q.length >= 4) return {number: Number(q), invalidNumber: q.length !== 4 || Number(q) < 1501 || Number(q) > 1600, tokens: []};
    }
    return {number: null, invalidNumber: false, tokens: q ? q.split(' ') : []};
  }
  function search(index, state) {
    const parts = queryParts(state.q);
    const status = statuses.includes(state.status) ? state.status : 'all';
    const sort = sorts.includes(state.sort) ? state.sort : 'number-asc';
    const allowed = index.catalog.filter(row => status === 'all' || (status === 'pending' ? row.release_status === null : row.release_status === status));
    const allowedNumbers = new Set(allowed.map(row => row.number));
    const matches = (numbers, text) => !parts.invalidNumber && (parts.number !== null ? numbers.includes(parts.number) : parts.tokens.every(token => normalize(text).includes(token)));
    const records = index.records.filter(row => (status === 'all' || row.catalog_numbers.some(number => allowedNumbers.has(number))) &&
      matches(row.catalog_numbers, [row.title, row.artist, ...row.album_titles].join(' ')));
    // 관련 앨범명만 맞은 다중 참여 인물을 통해 다른 번호까지 확장하지 않는다.
    const related = new Set(parts.number === null ? records.filter(row =>
      parts.tokens.every(token => normalize(row.title).includes(token))).flatMap(row => row.catalog_numbers) : []);
    const catalog = allowed.filter(row => matches([row.number], [String(row.number), row.title, row.artist].join(' ')) || (!parts.invalidNumber && related.has(row.number)));
    const compare = (a, b) => {
      if (sort === 'title') {
        if (!a.title && b.title) return 1;
        if (a.title && !b.title) return -1;
        const text = collator.compare(a.title || '', b.title || '');
        if (text) return text;
      }
      return (a.number - b.number) * (sort === 'number-desc' ? -1 : 1);
    };
    catalog.sort(compare);
    records.sort((a, b) => {
      if (sort !== 'title') {
        if (!a.catalog_numbers.length && b.catalog_numbers.length) return 1;
        if (a.catalog_numbers.length && !b.catalog_numbers.length) return -1;
        const order = (Math.min(...a.catalog_numbers, 9999) - Math.min(...b.catalog_numbers, 9999)) * (sort === 'number-desc' ? -1 : 1);
        if (order) return order;
      }
      return collator.compare(a.title, b.title) || a.key.localeCompare(b.key);
    });
    return {catalog, records};
  }
  const api = Object.freeze({normalize, safeQuery, readState, serialize, validateIndex, search});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BlueNoteSearch = api;
})(globalThis);
