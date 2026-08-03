(function(){
  const FEATURES = {
    profile:false,
    submissions:false,
    comments:false,
    likes:false,
    publishedSubmissions:false
  };

  const data = window.RESOURCE_DATA || [];
  data.forEach((item) => { item.contributor = item.contributor.split(' · ')[0]; });

  const state = {
    query:'',
    category:'all',
    audience:'all',
    sort:'latest',
    comments:FEATURES.comments ? JSON.parse(localStorage.getItem('resource-comments') || '{}') : {},
    likes:FEATURES.likes ? JSON.parse(localStorage.getItem('resource-likes') || '{}') : {}
  };
  let profileName = FEATURES.profile ? (localStorage.getItem('cbd-share-profile') || '') : '';

  const $ = (selector) => document.querySelector(selector);
  const grid = $('#resourceGrid');
  const resultCount = $('#resultCount');
  const empty = $('#emptyState');
  const filterPanel = $('#filterPanel');
  const filterCount = $('#filterCount');
  const audiences = ['全部','非技术背景','产品经理','职场人','行业从业者'];
  const categories = ['全部', ...new Set(data.map((item) => item.category))];

  function syncFeatureVisibility(){
    document.querySelectorAll('.future-feature').forEach((element) => {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    });
    if (FEATURES.profile || FEATURES.submissions) {
      const topbarActions = document.querySelector('.topbar-actions');
      if (topbarActions) {
        topbarActions.hidden = false;
        topbarActions.removeAttribute('aria-hidden');
      }
    }
    if (FEATURES.profile) {
      $('#profileButton')?.removeAttribute('hidden');
      $('#profileDrawer')?.removeAttribute('aria-hidden');
    }
    if (FEATURES.submissions) {
      $('#submitResource')?.removeAttribute('hidden');
      $('#submitDrawer')?.removeAttribute('aria-hidden');
    }
    if (FEATURES.profile || FEATURES.submissions || FEATURES.comments || FEATURES.likes) {
      $('#toast')?.removeAttribute('aria-hidden');
    }
  }

  function chip(label, type){
    const button = document.createElement('button');
    button.className = 'chip';
    button.textContent = label;
    button.type = 'button';
    button.dataset.value = label;
    button.addEventListener('click', () => {
      state[type] = label === '全部' ? 'all' : label;
      renderChips();
      render();
    });
    return button;
  }

  function renderChips(){
    const categoryChips = $('#categoryChips');
    const audienceChips = $('#audienceChips');
    categoryChips.innerHTML = '';
    audienceChips.innerHTML = '';
    categories.forEach((category) => {
      const button = chip(category, 'category');
      if ((state.category === 'all' && category === '全部') || state.category === category) button.classList.add('active');
      categoryChips.appendChild(button);
    });
    audiences.forEach((audience) => {
      const button = chip(audience, 'audience');
      if ((state.audience === 'all' && audience === '全部') || state.audience === audience) button.classList.add('active');
      audienceChips.appendChild(button);
    });
    const active = [state.category !== 'all', state.audience !== 'all'].filter(Boolean).length;
    filterCount.textContent = active ? `· ${active}` : '';
  }

  function match(item){
    const query = state.query.toLowerCase();
    const text = [item.title,item.summary,item.audience,item.problem,item.reason,item.contributor,...item.tags].join(' ').toLowerCase();
    const audienceMatched = state.audience === 'all' ||
      item.audience.includes(state.audience) ||
      (state.audience === '产品经理' && item.category.includes('产品')) ||
      (state.audience === '职场人' && item.category.includes('职场')) ||
      (state.audience === '行业从业者' && item.category.includes('行业'));
    return (!query || text.includes(query)) &&
      (state.category === 'all' || item.category === state.category) &&
      audienceMatched;
  }

  function getItems(){
    const items = data.filter(match);
    if (state.sort === 'latest') items.sort((a,b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (state.sort === 'recommended') items.sort((a,b) => b.score - a.score);
    if (state.sort === 'az') items.sort((a,b) => a.title.localeCompare(b.title, 'zh'));
    return items;
  }

  function render(){
    const items = getItems();
    grid.innerHTML = '';
    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'resource-card';
      card.tabIndex = 0;
      const likeCount = Number(state.likes[item.id] || 0);
      const commentCount = (state.comments[item.id] || []).length;
      card.innerHTML = `
        <div class="card-top"><span class="category-pill">${item.category}</span><span class="card-arrow">↗</span></div>
        <h3>${item.title}</h3>
        <p class="summary">${item.summary}</p>
        <div class="card-meta">
          <small>${item.contributor}</small>
          <div class="card-engagement">
            <strong>${item.updatedAt} · ${item.tags[0]}</strong>
            ${FEATURES.comments ? `<span class="comment-count">评论 ${commentCount}</span>` : ''}
            ${FEATURES.likes ? `<button class="like-button" type="button" aria-label="点赞 ${item.title}">♡ <span>${likeCount}</span></button>` : ''}
          </div>
        </div>
      `;
      card.addEventListener('click', () => openDetail(item));
      card.addEventListener('keydown', (event) => { if(event.key === 'Enter') openDetail(item); });
      if (FEATURES.likes) {
        const likeButton = card.querySelector('.like-button');
        likeButton.addEventListener('click', (event) => {
          event.stopPropagation();
          state.likes[item.id] = Number(state.likes[item.id] || 0) + 1;
          localStorage.setItem('resource-likes', JSON.stringify(state.likes));
          likeButton.classList.add('liked');
          likeButton.innerHTML = `♥ <span>${state.likes[item.id]}</span>`;
        });
      }
      grid.appendChild(card);
    });
    resultCount.textContent = `${items.length} 条资源`;
    empty.hidden = items.length !== 0;
  }

  function openDetail(item){
    const comments = state.comments[item.id] || [];
    const links = item.links && item.links.length ? item.links : (item.url ? [{ label:'打开资源', url:item.url }] : []);
    $('#detailContent').innerHTML = `
      <div class="detail-header">
        <span class="category-pill">${item.category}</span>
        <h2 id="detailTitle">${item.title}</h2>
        <p class="detail-summary">${item.summary}</p>
        <span class="resource-access-note">${links.length ? `${links.length} 个链接` : '内容分享'}</span>
        ${links.length ? `<div class="detail-links">${links.map((link) => `<a class="detail-link" href="${link.url}" target="_blank" rel="noreferrer">${link.label} ↗</a>`).join('')}</div>` : ''}
      </div>
      <div class="detail-section"><h4>推荐理由</h4><p>${item.reason}</p></div>
      <div class="detail-section">
        <div class="detail-info">
          <div><span>适合谁</span><strong>${item.audience}</strong></div>
          <div><span>解决什么问题</span><strong>${item.problem}</strong></div>
          <div><span>推荐人</span><strong>${item.contributor}</strong></div>
          <div><span>最近更新</span><strong>${item.updatedAt}</strong></div>
        </div>
      </div>
      ${FEATURES.comments ? `
        <div class="detail-section">
          <div class="comment-title"><h4>评论与补充</h4><span class="comment-count">${comments.length} 条</span></div>
          <div id="commentsList">${comments.length ? comments.map((comment) => `<div class="comment"><div class="comment-head"><b>${comment.name}</b><span>${comment.date}</span></div><p>${comment.text}</p></div>`).join('') : '<p class="muted-copy">还没有评论，欢迎补充你的使用体验。</p>'}</div>
          <form class="comment-form" id="commentForm"><input name="comment" required placeholder="分享你的体验或补充" /><button type="submit">发布</button></form>
        </div>
      ` : ''}
    `;
    $('#modalBackdrop').hidden = false;
    $('#detailDrawer').hidden = false;
    document.body.style.overflow = 'hidden';
    if (FEATURES.comments) {
      $('#commentForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const text = event.target.comment.value.trim();
        if (!text) return;
        (state.comments[item.id] ||= []).push({ name:'新朋友', date:'刚刚', text });
        localStorage.setItem('resource-comments', JSON.stringify(state.comments));
        openDetail(item);
        showToast('评论已添加');
      });
    }
  }

  function closeAll(){
    $('#modalBackdrop').hidden = true;
    $('#detailDrawer').hidden = true;
    if ($('#submitDrawer')) $('#submitDrawer').hidden = true;
    if ($('#profileDrawer')) $('#profileDrawer').hidden = true;
    document.body.style.overflow = '';
  }

  function showToast(message){
    const toast = $('#toast');
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function setupFutureFeatures(){
    const shareType = $('#shareType');
    if (FEATURES.submissions && shareType) {
      const syncShareFields = () => {
        const type = shareType.value;
        $('#singleLinkField').hidden = type !== 'single';
        $('#multipleLinkField').hidden = type !== 'multiple';
        $('#singleLinkField input').required = type === 'single';
        $('#multipleLinkField textarea').required = type === 'multiple';
      };
      shareType.addEventListener('change', syncShareFields);
      syncShareFields();
      $('#submitResource').addEventListener('click', () => {
        $('#modalBackdrop').hidden = false;
        $('#submitDrawer').hidden = false;
        document.body.style.overflow = 'hidden';
      });
      $('#closeSubmit').addEventListener('click', closeAll);
      $('#submitForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const shareTypeValue = form.get('shareType');
        const links = shareTypeValue === 'multiple' ? String(form.get('links') || '').split('\n').map((line) => {
          const [label, url] = line.split('|').map((value) => value.trim());
          return url ? { label: label || '打开链接', url } : null;
        }).filter(Boolean) : [];
        const response = await fetch('/api/submissions', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({
            title:form.get('title'),
            category:form.get('category'),
            shareType:shareTypeValue,
            contributor:profileName || '新朋友',
            url:shareTypeValue === 'single' ? form.get('url') : '',
            links,
            reason:form.get('reason')
          })
        });
        if (!response.ok) throw new Error('submit failed');
        formElement.reset();
        syncShareFields();
        closeAll();
        showToast('已提交审核，后台审核后会出现在大家分享');
      });
    }

    if (FEATURES.profile && $('#profileForm')) {
      $('#profileName').value = profileName;
      $('#profileButton').addEventListener('click', () => {
        $('#modalBackdrop').hidden = false;
        $('#profileDrawer').hidden = false;
        document.body.style.overflow = 'hidden';
      });
      $('#closeProfile').addEventListener('click', closeAll);
      $('#profileForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get('name') || '').trim();
        if (!name) return;
        profileName = name;
        localStorage.setItem('cbd-share-profile', name);
        await fetch('/api/profile', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ name }) });
        closeAll();
        showToast(`已保存昵称：${name}`);
      });
    }
  }

  async function loadPublishedSubmissions(){
    if (!FEATURES.publishedSubmissions) return;
    const response = await fetch('/api/submissions?status=published');
    if (!response.ok) return;
    const payload = await response.json();
    const published = Array.isArray(payload) ? payload : (payload.value || []);
    published.forEach((item) => {
      if (data.some((existing) => existing.id === item.id)) return;
      data.push({
        ...item,
        summary:item.reason.slice(0, 110),
        audience:'待补充',
        problem:'详见作者原话',
        contributor:item.contributor || '新朋友',
        tags:[item.shareType === 'content' ? '内容分享' : '新提交'],
        updatedAt:item.updatedAt.slice(0,10),
        score:70
      });
    });
    if (published.length) {
      $('#metricTotal').textContent = data.length;
      $('#heroCount').textContent = data.length;
      syncLatestDate();
      renderChips();
      render();
    }
  }

  const latestDate = () => data.map((item) => String(item.updatedAt || '').slice(0,10)).filter(Boolean).sort().pop() || '暂无';
  const syncLatestDate = () => {
    const date = latestDate();
    $('#metricLatestDate').textContent = date;
    $('#heroUpdatedAt').textContent = date;
  };

  syncFeatureVisibility();
  setupFutureFeatures();
  $('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  $('#sortSelect').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
  $('#filterToggle').addEventListener('click', () => { filterPanel.hidden = !filterPanel.hidden; });
  $('#clearFilters').addEventListener('click', () => {
    state.category = 'all';
    state.audience = 'all';
    state.query = '';
    $('#searchInput').value = '';
    renderChips();
    render();
  });
  $('#emptyClear').addEventListener('click', () => { $('#clearFilters').click(); });
  $('#closeDrawer').addEventListener('click', closeAll);
  $('#modalBackdrop').addEventListener('click', closeAll);
  $('#randomPick').addEventListener('click', () => {
    const items = getItems();
    if (items.length) openDetail(items[Math.floor(Math.random() * items.length)]);
  });

  $('#metricTotal').textContent = data.length;
  $('#heroCount').textContent = data.length;
  $('#metricCategories').textContent = categories.length - 1;
  syncLatestDate();
  renderChips();
  render();
  loadPublishedSubmissions();
})();
