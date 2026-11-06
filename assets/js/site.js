'use strict';

const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('#site-nav');
if (menuButton && navigation) {
  menuButton.hidden = false;
  document.documentElement.classList.add('has-js');
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  };
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
}

async function checkPublicData() {
  const main = document.querySelector('main');
  const notice = document.querySelector('#data-status');
  if (!main || !notice) return;
  try {
    const response = await fetch('/bluenote/data/version.json', {cache: 'no-store', credentials: 'omit'});
    if (!response.ok) throw new Error(response.status === 404 ? 'data-missing' : 'data-unavailable');
    const version = await response.json();
    if (version.schema_version !== 1 || typeof version.data_version !== 'string') throw new Error('data-format');
    if (version.data_version !== main.dataset.jsonVersion) {
      throw new Error('data-version-mismatch');
    }
    if (document.body.dataset.page === 'catalog') {
      const catalogResponse = await fetch('/bluenote/data/catalog.json', {cache: 'no-store', credentials: 'omit'});
      if (!catalogResponse.ok) throw new Error(catalogResponse.status === 404 ? 'data-missing' : 'data-unavailable');
      const catalog = await catalogResponse.json();
      if (catalog.schema_version !== 1 || !Array.isArray(catalog.entries) || catalog.entries.length !== 100 ||
          !catalog.entries.every((entry, index) => entry && entry.number === index + 1501)) {
        throw new Error('catalog-format');
      }
    }
    const detail = location.pathname.match(/^\/bluenote\/(albums|tracks|musicians)\/([a-z][a-z0-9-]{2,79})\/$/);
    if (detail && document.querySelector('.detail-layout')) {
      const response = await fetch('/bluenote/data/' + detail[1] + '/' + detail[2] + '.json', {cache:'no-store',credentials:'omit'});
      if (!response.ok) throw new Error(response.status === 404 ? 'data-missing' : 'data-unavailable');
      const data = await response.json();
      const root = data.records?.[0];
      const field = detail[1] === 'musicians' ? 'name' : 'title';
      if (data.schema_version !== 1 || data.root_key !== detail[2] || root?.key !== detail[2] || root?.kind !== detail[1] || typeof root?.fields?.[field]?.value !== 'string') throw new Error('data-format');
    }
  } catch (error) {
    let message = '공개 데이터를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
    if (error.message === 'data-missing') message = '공개 데이터 파일을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.';
    if (error.message === 'data-version-mismatch') message = '페이지와 공개 데이터의 버전이 다릅니다. 새로고침 후 다시 확인해 주세요.';
    if (error.message === 'data-format' || error.message === 'catalog-format' || error instanceof SyntaxError) message = '공개 데이터의 형식을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    notice.textContent = message + ' 아래 내용은 페이지 생성 당시의 정보입니다.';
    notice.hidden = false;
  }
}
checkPublicData();

const homeSearch = document.querySelector('#home-search');
if (homeSearch) homeSearch.addEventListener('submit', event => {
  const field = document.querySelector('#home-query');
  const safe = globalThis.BlueNoteSearch?.safeQuery(field.value) ?? '';
  if (field.value.trim() && !safe) {
    event.preventDefault();
    field.value = '';
    document.querySelector('#home-search-note').textContent = '검색어의 길이와 내용을 확인해 주세요. 비밀정보나 내부 경로는 검색 주소에 넣지 않습니다.';
  } else field.value = safe;
});
