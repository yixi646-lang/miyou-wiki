export function foldButtons(scope = 'page', label = '内容') {
  return `<button type="button" data-fold="expand" data-fold-scope="${scope}" aria-label="全部展开${label}">全部展开</button><button type="button" data-fold="collapse" data-fold-scope="${scope}" aria-label="全部折叠${label}">全部折叠</button>`;
}

// 列表重绘保留内容状态；批量默认值也适用于随后筛出的条目。
export function createListDisclosureState() {
  const scopes = new Map();
  let current;
  return {
    selectScope(key) {
      if (!scopes.has(key)) scopes.set(key, {open: false, items: new Map()});
      current = scopes.get(key);
    },
    remember(id, open) { current?.items.set(id, open); },
    isOpen(id) { return current?.items.get(id) ?? current?.open ?? false; },
    setAll(open) { if (current) { current.open = open; current.items.clear(); } }
  };
}

const ignoredDisclosure='.filters,.picker-filters,.stat-filters,.banner-stat-scope,[data-disclosure-ignore]';
const contentDetails=container=>[...container.querySelectorAll('details')].filter(detail=>!detail.closest(ignoredDisclosure));
const cardDisclosureScope='details,[data-card-disclosure]';
const childDetails=container=>contentDetails(container).filter(detail=>detail.parentElement?.closest(cardDisclosureScope)===container);

export function setCardDisclosure(container,open){
  if(!container||container.closest(ignoredDisclosure))return;
  // 标题控制自身，按钮只控制下一级；更深层、同级与筛选状态保留。
  for(const child of childDetails(container))child.open=open;
}

export function addCardDisclosureControls(container){
  if(!container)return;
  for(const card of container.querySelectorAll(cardDisclosureScope)){
    if(card.closest(ignoredDisclosure))continue;
    const isDetail=card.matches('details'),heading=card.querySelector(isDetail?':scope > summary':':scope > [data-card-disclosure-heading]');
    if(!heading)continue;
    if(isDetail){card.dataset.cardDisclosureTitle??=heading.textContent;heading.classList.add('ae-card-summary');}
    const existing=heading.querySelector('[data-card-fold-controls]');
    if(!childDetails(card).length){existing?.remove();continue;}
    if(existing)continue;
    const controls=document.createElement('span');controls.className='ae-card-fold-controls';controls.dataset.cardFoldControls='';
    controls.title='只控制内部下一级卡片，保留更深层的展开状态。'+(isDetail?'点击标题可展开或折叠本卡片。':'');
    controls.innerHTML='<span class="ae-card-fold-label">下一级：</span><button type="button" class="subtle-action" data-fold="expand" data-fold-scope="card" aria-label="展开下一级卡片">展开</button><button type="button" class="subtle-action" data-fold="collapse" data-fold-scope="card" aria-label="折叠下一级卡片">折叠</button>';
    heading.append(controls);
  }
}

// 页面批量操作仅影响资料内容，筛选面板保持独立。
export function installDisclosureControls(host, {onBulk = () => {}} = {}) {
  const sync = () => {
    addCardDisclosureControls(host.querySelector('.ae-independent-team'));
    const existing = host.querySelector('[data-page-fold-controls]');
    const hasContent = contentDetails(host).length > 0;
    if (!hasContent) { existing?.remove(); return; }
    if (existing) return;
    const bar = document.createElement('div');
    bar.className = 'page-fold-controls';
    bar.dataset.pageFoldControls = '';
    const assessmentTitle=host.querySelector('.ae-titlebar');
    bar.innerHTML = (assessmentTitle?'':'<span>页面内容</span>') + foldButtons();
    if(assessmentTitle)assessmentTitle.append(bar);
    else (host.querySelector('.catalog-actions,.dialog-body') ?? host).prepend(bar);
  };
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-fold]');
    if (!button || !host.contains(button)) return;
    const open = button.dataset.fold === 'expand';
    const scope = button.dataset.foldScope ?? 'page';
    if(scope==='card'){
      event.preventDefault();event.stopPropagation();
      setCardDisclosure(button.closest(cardDisclosureScope),open);return;
    }
    if (scope === 'page') onBulk(open);
    const container = scope === 'page' ? host : host.querySelector('#' + scope);
    if (container) contentDetails(container).forEach(detail => { detail.open = open; });
  });
  new MutationObserver(sync).observe(host, {childList: true, subtree: true});
  sync();
}
