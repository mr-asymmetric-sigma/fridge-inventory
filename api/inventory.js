import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

const DEFAULT_SECTIONS = [
  { id: 's1', title: '冻库上层', items: [] },
  { id: 's2', title: '冻库下层', items: [] }
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    let data = await redis.get('fridge_data')
    if (!data) {
      data = { sections: DEFAULT_SECTIONS, logs: [] }
      await redis.set('fridge_data', data)
    }
    return res.json(data)
  }

  if (req.method === 'POST') {
    const { action, payload } = req.body
    let data = await redis.get('fridge_data')
    if (!data) data = { sections: DEFAULT_SECTIONS, logs: [] }

    if (action === 'decrement') {
      const { sid, iid } = payload
      const sec = data.sections.find(s => s.id === sid)
      const it = sec?.items.find(i => i.id === iid)
      if (!it) return res.status(404).json({ error: 'not found' })
      const step = it.qty >= 1 ? 1 : 0.5
      it.qty = Math.max(0, parseFloat((it.qty - step).toFixed(2)))
      data.logs.unshift({ name: it.name, qty: it.qty, type: 'use', time: Date.now() })
      if (data.logs.length > 80) data.logs = data.logs.slice(0, 80)
    }

    if (action === 'restock') {
      const { sid, iid, qty } = payload
      const sec = data.sections.find(s => s.id === sid)
      const it = sec?.items.find(i => i.id === iid)
      if (!it) return res.status(404).json({ error: 'not found' })
      it.qty = parseFloat((it.qty + qty).toFixed(2))
      data.logs.unshift({ name: it.name, qty: it.qty, added: qty, type: 'add', time: Date.now() })
      if (data.logs.length > 80) data.logs = data.logs.slice(0, 80)
    }

    if (action === 'add_item') {
      const { sid, name, qty, unit } = payload
      const sec = data.sections.find(s => s.id === sid)
      if (!sec) return res.status(404).json({ error: 'section not found' })
      sec.items.push({ id: 'c' + Date.now(), name, qty, unit })
      data.logs.unshift({ name, qty, added: qty, type: 'add', time: Date.now() })
      if (data.logs.length > 80) data.logs = data.logs.slice(0, 80)
    }

    if (action === 'delete_item') {
      const { sid, iid } = payload
      const sec = data.sections.find(s => s.id === sid)
      if (!sec) return res.status(404).json({ error: 'section not found' })
      const it = sec.items.find(i => i.id === iid)
      sec.items = sec.items.filter(i => i.id !== iid)
      if (it) data.logs.unshift({ name: it.name, qty: 0, type: 'delete', time: Date.now() })
      if (data.logs.length > 80) data.logs = data.logs.slice(0, 80)
    }

    if (action === 'add_section') {
      const { title } = payload
      if (!title) return res.status(400).json({ error: 'title required' })
      data.sections.push({ id: 's' + Date.now(), title, items: [] })
    }

    await redis.set('fridge_data', data)
    return res.json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
