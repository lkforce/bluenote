'use strict';
(async function () {
  const form = document.querySelector('#catalog-search');
  if (!form) return;
  const engine = globalThis.BlueNoteSearch;
  const query = document.querySelector('#search-query');
  const status = document.querySelector('#search-status');
  const sort = document.querySelector('#search-sort');
  const reset = document.querySelector('#search-reset');
  const message = document.querySelector('#search-message');
  const count = document.querySelector('#search-count');
  const grid = document.querySelector('.catalog-grid');
  const content = document.querySelector('#content-search-results');
  const empty = document.querySelector('#catalog-search-empty');
  const region = document.querySelector('#search-region');
  const cards = new Map(Array.from(grid.children, card => [Number(card.dataset.number), card]));
  let index;
  let state = {q: '', status: 'all', sort: 'number-asc'};
  const kinds = {album: '앨범', musician: '뮤지션', track: '트랙'};
  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function controls() {
    query.value = state.q;
    status.value = state.status;
    sort.value = state.sort;
  }
  function render() {
    const result = engine.search(index, state);
    const visible = new Set(result.catalog.map(row => row.number));
    for (const [number, card] of cards) card.hidden = !visible.has(number);
    for (const row of result.catalog) grid.append(cards.get(row.number));
    count.textContent = '카탈로그 ' + result.catalog.length + ' / 100개 번호 · 공개 콘텐츠 ' + result.records.length + '건';
    empty.hidden = result.catalog.length !== 0;
    content.replaceChildren();
    if (!result.records.length) {
      content.append(element('p', state.q ? '검색어에 맞는 공개 앨범·뮤지션·트랙 자료가 없습니다.' : '공개 검수를 마친 앨범·뮤지션·트랙 자료를 준비하고 있습니다.', 'search-empty-note'));
    }
    for (const row of result.records) {
      const card = element('article', '', 'content-result');
      card.append(element('p', kinds[row.kind] + ' · 공개 승인 목록 정보', 'eyebrow'));
      card.append(element('h3', row.title));
      const context = [row.catalog_numbers.length ? row.catalog_numbers.map(n => 'BLP ' + n).join(' · ') : '관련 번호 미확인', row.artist, ...row.album_titles].filter(Boolean).join(' / ');
      card.append(element('p', context, 'result-context'));
      if (row.url) {
        const link = element('a', '상세 자료 읽기 →', 'text-link');
        link.href = row.url;
        card.append(link);
      }
      if (!row.url) card.append(element('p', '상세 페이지는 준비 중입니다.', 'small-note'));
      content.append(card);
    }
    region.setAttribute('aria-busy', 'false');
    form.dataset.ready = 'true';
  }
  function apply(mode, next) {
    state = next;
    if (state.sort === 'title' && !index.catalog.some(row => row.title)) state.sort = 'number-asc';
    controls();
    render();
    const destination = '/bluenote/catalog/' + engine.serialize(state);
    if (mode && location.pathname + location.search !== destination) {
      history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', destination);
    }
    const filterText = status.options[status.selectedIndex].text;
    message.textContent = state.invalid ? '사용할 수 없는 검색 조건은 초기화했습니다.' :
      (state.q ? '검색어: ' + state.q + ' · ' : '') + filterText + ' · ' + sort.options[sort.selectedIndex].text;
  }
  try {
    if (!engine) throw new Error('search-format');
    const response = await fetch('/bluenote/assets/data/search-index.json', {cache: 'no-store', credentials: 'omit'});
    if (!response.ok) throw new Error(response.status === 404 ? 'search-missing' : 'search-load');
    index = engine.validateIndex(await response.json(), document.querySelector('main').dataset.jsonVersion);
    for (const control of form.querySelectorAll('input,select,button')) control.disabled = false;
    const titleOption = sort.querySelector('option[value="title"]');
    titleOption.disabled = !index.catalog.some(row => row.title);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const params = new URLSearchParams({q: query.value, status: status.value, sort: sort.value});
      apply('push', engine.readState(params));
    });
    for (const control of [status, sort]) control.addEventListener('change', () => form.requestSubmit());
    reset.addEventListener('click', () => {
      apply('push', {q: '', status: 'all', sort: 'number-asc'});
      query.focus();
    });
    query.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        query.value = '';
        form.requestSubmit();
      }
    });
    window.addEventListener('popstate', () => apply('replace', engine.readState(location.search)));
    apply('replace', engine.readState(location.search));
  } catch (error) {
    region.setAttribute('aria-busy', 'false');
    form.dataset.ready = 'error';
    let text = '검색 자료를 불러오지 못했습니다. 연결 상태를 확인하고 새로고침해 주세요.';
    if (error.message === 'search-missing') text = '검색 자료 파일을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.';
    if (error.message === 'search-format' || error instanceof SyntaxError) text = '검색 자료의 형식을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    message.textContent = text + ' 아래 목록은 생성 당시의 전체 번호입니다.';
    count.textContent = '검색 사용 불가 · 생성 당시 전체 번호 표시';
    message.classList.add('search-error');
  }
})();
