let state = null
let collapsed = {}
let addMode = 'rs'
let busy = false

function fq(q) { return Number.isInteger(q) ? q : parseFloat(parseFloat(q).toFixed(2)) }
function ft(ts) {
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

async function api(method, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch('/api/inventory', opts)
  if (!r.ok) throw new Error('API error ' + r.status)
  return r.json()
}

async function load() {
  try {
    state = await api('GET')
    collapsed = state.collapsed || {}
    render()
  } catch(e) {
    document.getElementById('main').innerHTML = '<div class="empty-tip">加载失败，请刷新页面重试</div>'
    document.getElementById('stats-text').textContent = ''
  }
}

async function post(action, payload) {
  if (busy) return
  busy = true
  try {
    state = await api('POST', { action, payload })
    render()
  } catch(e) {
    showToast('操作失败，请重试')
  }
  busy = false
}

function render() {
  if (!state) return
  const all = state.sections.flatMap(s => s.items)
  const ec = all.filter(i => i.qty <= 0).length
  document.getElementById('stats-text').textContent = ec > 0 ? `共${all.length}件，${ec}件已用完` : `共${all.length}件`

  document.getElementById('main').innerHTML = state.sections.map(sec => {
    const isCol = !!collapsed[sec.id]
    const emptyC = sec.items.filter(i => i.qty <= 0).length
    const rows = isCol ? '' : `<div class="item-list">${sec.items.map(it => {
      const emp = it.qty <= 0
      return `<div class="item-row${emp?' empty':''}">
        <div class="item-info">
          <div class="item-name">${it.name}</div>
          ${emp ? '<div class="empty-label">已用完</div>' : ''}
        </div>
        <div class="item-ctrl">
          <span class="qty-val">${fq(it.qty)}</span>
          <span class="qty-unit">${it.unit}</span>
          <div class="btn-minus${emp?' disabled':''}" onclick="${emp?'':``dec('${sec.id}','${it.id}')``}" role="button" aria-label="减少${it.name}">−</div>
        </div>
      </div>`
    }).join('')}</div>`

    return `<div>
      <div class="sec-hdr" onclick="togSec('${sec.id}')">
        <div class="sec-title">${sec.title}${emptyC > 0 ? `<span class="sec-empty-badge">${emptyC}件空</span>` : ''}</div>
        <span class="sec-arrow${isCol?' col':''}">▾</span>
      </div>${rows}
    </div>`
  }).join('') + '<div class="pull-hint">下拉刷新获取最新数据</div>'
}

function dec(sid, iid) { post('decrement', { sid, iid }) }

function togSec(sid) {
  collapsed[sid] = !collapsed[sid]
  render()
}

function openAdd() {
  const sel = document.getElementById('sel-item')
  sel.innerHTML = ''
  if (state) {
    state.sections.forEach(sec => {
      const og = document.createElement('optgroup')
      og.label = sec.title
      sec.items.forEach(it => {
        const o = document.createElement('option')
        o.value = JSON.stringify({ sid: sec.id, iid: it.id })
        o.textContent = `${it.name} (${it.unit})  现有:${fq(it.qty)}`
        og.appendChild(o)
      })
      sel.appendChild(og)
    })
    const ss = document.getElementById('sel-sec')
    ss.innerHTML = state.sections.map(s => `<option value="${s.id}">${s.title}</option>`).join('')
  }
  document.getElementById('ov-add').classList.add('open')
}

function openLog() {
  const el = document.getElementById('log-body')
  if (!state || !state.logs || !state.logs.length) {
    el.innerHTML = '<div class="empty-tip">暂无操作记录</div>'
  } else {
    el.innerHTML = '<div class="log-list">' + state.logs.slice(0, 60).map(l => {
      const badge = l.type === 'add'
        ? `<span class="log-badge add">+${fq(l.added || l.qty)}</span>`
        : `<span class="log-badge use">取用</span>`
      return `<div class="log-row">
        <span class="log-name">${l.name}</span>
        ${badge}
        <div class="log-meta">
          <div class="log-remain">剩 ${fq(l.qty)}</div>
          <div class="log-time">${ft(l.time)}</div>
        </div>
      </div>`
    }).join('') + '</div>'
  }
  document.getElementById('ov-log').classList.add('open')
}

function closeSheet(t) { document.getElementById('ov-' + t).classList.remove('open') }

function setMode(m) {
  addMode = m
  document.getElementById('tab-rs').className = 'tab' + (m === 'rs' ? ' act' : '')
  document.getElementById('tab-nw').className = 'tab' + (m === 'nw' ? ' act' : '')
  document.getElementById('form-rs').style.display = m === 'rs' ? '' : 'none'
  document.getElementById('form-nw').style.display = m === 'nw' ? '' : 'none'
}

async function doRestock() {
  const raw = document.getElementById('sel-item').value
  if (!raw) return
  const { sid, iid } = JSON.parse(raw)
  const qty = parseFloat(document.getElementById('inp-rsqty').value)
  if (isNaN(qty) || qty <= 0) { showToast('请填写正确数量'); return }
  const btn = document.getElementById('btn-rs')
  btn.disabled = true; btn.textContent = '保存中…'
  await post('restock', { sid, iid, qty })
  btn.disabled = false; btn.textContent = '确认补货'
  showToast('补货成功 ✓')
  closeSheet('add')
}

async function doAddNew() {
  const name = document.getElementById('inp-name').value.trim()
  const qty = parseFloat(document.getElementById('inp-nwqty').value) || 0
  const unit = document.getElementById('inp-unit').value.trim() || '个'
  const sid = document.getElementById('sel-sec').value
  if (!name) { showToast('请填写物品名称'); return }
  const btn = document.getElementById('btn-nw')
  btn.disabled = true; btn.textContent = '保存中…'
  await post('add_item', { sid, name, qty, unit })
  btn.disabled = false; btn.textContent = '添加物品'
  showToast('添加成功 ✓')
  closeSheet('add')
  document.getElementById('inp-name').value = ''
  document.getElementById('inp-nwqty').value = '1'
  document.getElementById('inp-unit').value = ''
}

function showToast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 2000)
}

document.querySelectorAll('.overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open') })
})

// Pull-to-refresh on mobile
let startY = 0
document.addEventListener('touchstart', e => { startY = e.touches[0].clientY }, { passive: true })
document.addEventListener('touchend', e => {
  const dy = e.changedTouches[0].clientY - startY
  if (dy > 80 && window.scrollY === 0) load()
}, { passive: true })

load()
setInterval(load, 30000)

console.log('app.js loaded')
