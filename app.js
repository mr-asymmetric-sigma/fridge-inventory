console.log('app.js loaded aaa')

let state = null
let collapsed = {}
let addMode = 'rs'
let busy = false

function fq(q) { return Number.isInteger(q) ? q : parseFloat(parseFloat(q).toFixed(2)) }
function ft(ts) {
  const d = new Date(ts)
  return (d.getMonth()+1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
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
  const all = state.sections.flatMap(function(s) { return s.items })
  const ec = all.filter(function(i) { return i.qty <= 0 }).length
  document.getElementById('stats-text').textContent = ec > 0 ? '共' + all.length + '件，' + ec + '件已用完' : '共' + all.length + '件'

  var html = ''
  state.sections.forEach(function(sec) {
    var isCol = !!collapsed[sec.id]
    var emptyC = sec.items.filter(function(i) { return i.qty <= 0 }).length
    var emptyBadge = emptyC > 0 ? '<span class="sec-empty-badge">' + emptyC + '件空</span>' : ''
    var arrowClass = isCol ? 'sec-arrow col' : 'sec-arrow'

    var rows = ''
    if (!isCol) {
      var rowsHtml = ''
      sec.items.forEach(function(it) {
        var emp = it.qty <= 0
        var emptyLabel = emp ? '<div class="empty-label">已用完</div>' : ''
        var empClass = emp ? 'item-row empty' : 'item-row'
        var onclick = emp ? '' : 'onclick="dec(\'' + sec.id + '\',\'' + it.id + '\')"'
        var btnClass = emp ? 'btn-minus disabled' : 'btn-minus'
        rowsHtml += '<div class="' + empClass + '">' +
          '<div class="item-info"><div class="item-name">' + it.name + '</div>' + emptyLabel + '</div>' +
          '<div class="item-ctrl">' +
          '<span class="qty-val">' + fq(it.qty) + '</span>' +
          '<span class="qty-unit">' + it.unit + '</span>' +
          '<div class="' + btnClass + '" ' + onclick + ' role="button" aria-label="减少' + it.name + '">−</div>' +
          '</div></div>'
      })
      rows = '<div class="item-list">' + rowsHtml + '</div>'
    }

    html += '<div>' +
      '<div class="sec-hdr" onclick="togSec(\'' + sec.id + '\')">' +
      '<div class="sec-title">' + sec.title + emptyBadge + '</div>' +
      '<span class="' + arrowClass + '">▾</span>' +
      '</div>' + rows + '</div>'
  })

  html += '<div class="pull-hint">下拉刷新获取最新数据</div>'
  document.getElementById('main').innerHTML = html
}

function dec(sid, iid) { post('decrement', { sid: sid, iid: iid }) }

function togSec(sid) {
  collapsed[sid] = !collapsed[sid]
  render()
}

function openAdd() {
  var sel = document.getElementById('sel-item')
  sel.innerHTML = ''
  if (state) {
    state.sections.forEach(function(sec) {
      var og = document.createElement('optgroup')
      og.label = sec.title
      sec.items.forEach(function(it) {
        var o = document.createElement('option')
        o.value = JSON.stringify({ sid: sec.id, iid: it.id })
        o.textContent = it.name + ' (' + it.unit + ')  现有:' + fq(it.qty)
        og.appendChild(o)
      })
      sel.appendChild(og)
    })
    var ss = document.getElementById('sel-sec')
    ss.innerHTML = state.sections.map(function(s) {
      return '<option value="' + s.id + '">' + s.title + '</option>'
    }).join('')
  }
  document.getElementById('ov-add').classList.add('open')
}

function openLog() {
  var el = document.getElementById('log-body')
  if (!state || !state.logs || !state.logs.length) {
    el.innerHTML = '<div class="empty-tip">暂无操作记录</div>'
  } else {
    var html = '<div class="log-list">'
    state.logs.slice(0, 60).forEach(function(l) {
      var badge = l.type === 'add'
        ? '<span class="log-badge add">+' + fq(l.added || l.qty) + '</span>'
        : '<span class="log-badge use">取用</span>'
      html += '<div class="log-row">' +
        '<span class="log-name">' + l.name + '</span>' +
        badge +
        '<div class="log-meta">' +
        '<div class="log-remain">剩 ' + fq(l.qty) + '</div>' +
        '<div class="log-time">' + ft(l.time) + '</div>' +
        '</div></div>'
    })
    html += '</div>'
    el.innerHTML = html
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
  var raw = document.getElementById('sel-item').value
  if (!raw) return
  var ref = JSON.parse(raw)
  var qty = parseFloat(document.getElementById('inp-rsqty').value)
  if (isNaN(qty) || qty <= 0) { showToast('请填写正确数量'); return }
  var btn = document.getElementById('btn-rs')
  btn.disabled = true; btn.textContent = '保存中…'
  await post('restock', { sid: ref.sid, iid: ref.iid, qty: qty })
  btn.disabled = false; btn.textContent = '确认补货'
  showToast('补货成功 ✓')
  closeSheet('add')
}

async function doAddNew() {
  var name = document.getElementById('inp-name').value.trim()
  var qty = parseFloat(document.getElementById('inp-nwqty').value) || 0
  var unit = document.getElementById('inp-unit').value.trim() || '个'
  var sid = document.getElementById('sel-sec').value
  if (!name) { showToast('请填写物品名称'); return }
  var btn = document.getElementById('btn-nw')
  btn.disabled = true; btn.textContent = '保存中…'
  await post('add_item', { sid: sid, name: name, qty: qty, unit: unit })
  btn.disabled = false; btn.textContent = '添加物品'
  showToast('添加成功 ✓')
  closeSheet('add')
  document.getElementById('inp-name').value = ''
  document.getElementById('inp-nwqty').value = '1'
  document.getElementById('inp-unit').value = ''
}

function showToast(msg) {
  var t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('show')
  setTimeout(function() { t.classList.remove('show') }, 2000)
}

document.querySelectorAll('.overlay').forEach(function(el) {
  el.addEventListener('click', function(e) { if (e.target === el) el.classList.remove('open') })
})

var startY = 0
document.addEventListener('touchstart', function(e) { startY = e.touches[0].clientY }, { passive: true })
document.addEventListener('touchend', function(e) {
  var dy = e.changedTouches[0].clientY - startY
  if (dy > 80 && window.scrollY === 0) load()
}, { passive: true })

load()
setInterval(load, 30000)

console.log('app.js finished')
