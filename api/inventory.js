import { kv } from '@vercel/kv'

const DEFAULT_SECTIONS = [
  {id:'s1', title:'冻库上层', items:[
    {id:'i1',name:'猪梅花',qty:3,unit:'包'},{id:'i2',name:'吊龙',qty:3,unit:'包'},
    {id:'i3',name:'牛肉条',qty:2,unit:'包'},{id:'i4',name:'牛尾',qty:1,unit:'包'},
    {id:'i5',name:'和牛排',qty:3,unit:'块'},{id:'i6',name:'牛肋骨',qty:1,unit:'包'},
    {id:'i7',name:'猪肉末',qty:5,unit:'包'},{id:'i8',name:'牛肉末',qty:2,unit:'包'},
    {id:'i9',name:'三文鱼',qty:4,unit:'块'},{id:'i10',name:'鱼片',qty:5,unit:'包'},
    {id:'i11',name:'鸡腿',qty:1,unit:'包'},{id:'i12',name:'鸡半只',qty:1,unit:'个'},
    {id:'i13',name:'猪排骨',qty:1,unit:'包'},{id:'i14',name:'肉片',qty:0.5,unit:'盒'},
    {id:'i15',name:'虾仁',qty:1,unit:'包'},{id:'i16',name:'笋',qty:1.5,unit:'包'},
    {id:'i17',name:'铁棍山药',qty:1,unit:'根'},{id:'i18',name:'藕片',qty:1,unit:'包'},
  ]},
  {id:'s2', title:'冻库下层', items:[
    {id:'i19',name:'五花肉',qty:1,unit:'块'},{id:'i20',name:'咸肉',qty:1,unit:'小袋'},
    {id:'i21',name:'猪舌',qty:1,unit:'个'},{id:'i22',name:'酱牛肉',qty:2,unit:'块'},
    {id:'i23',name:'熏肉',qty:1,unit:'块'},{id:'i24',name:'绿茶饼',qty:12,unit:'个'},
    {id:'i25',name:'花蛤',qty:1.5,unit:'包'},{id:'i26',name:'带子',qty:0.5,unit:'包'},
    {id:'i27',name:'鳕鱼',qty:1,unit:'小块'},{id:'i28',name:'丸子',qty:0.8,unit:'包'},
    {id:'i29',name:'虾仁(下)',qty:0.5,unit:'包'},{id:'i30',name:'火腿肠',qty:5,unit:'根'},
    {id:'i31',name:'豆泡',qty:1.5,unit:'包'},{id:'i32',name:'包浆豆腐',qty:1,unit:'盒'},
    {id:'i33',name:'蟹肉棒',qty:0.5,unit:'包'},{id:'i34',name:'栗子仁',qty:0.5,unit:'包'},
    {id:'i35',name:'红薯条',qty:1,unit:'小包'},{id:'i36',name:'腌笃鲜',qty:1,unit:'份'},
  ]}
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    let data = await kv.get('fridge_data')
    if (!data) {
      data = { sections: DEFAULT_SECTIONS, logs: [] }
      await kv.set('fridge_data', data)
    }
    return res.json(data)
  }

  if (req.method === 'POST') {
    const { action, payload } = req.body
    let data = await kv.get('fridge_data')
    if (!data) data = { sections: DEFAULT_SECTIONS, logs: [] }

    if (action === 'decrement') {
      const { sid, iid } = payload
      const sec = data.sections.find(s => s.id === sid)
      if (!sec) return res.status(404).json({ error: 'section not found' })
      const it = sec.items.find(i => i.id === iid)
      if (!it) return res.status(404).json({ error: 'item not found' })
      const step = it.qty >= 1 ? 1 : 0.5
      it.qty = Math.max(0, parseFloat((it.qty - step).toFixed(2)))
      data.logs.unshift({ name: it.name, qty: it.qty, type: 'use', time: Date.now() })
      if (data.logs.length > 80) data.logs = data.logs.slice(0, 80)
    }

    if (action === 'restock') {
      const { sid, iid, qty } = payload
      const sec = data.sections.find(s => s.id === sid)
      const it = sec?.items.find(i => i.id === iid)
      if (!it) return res.status(404).json({ error: 'item not found' })
      it.qty = parseFloat((it.qty + qty).toFixed(2))
      data.logs.unshift({ name: it.name, qty: it.qty, added: qty, type: 'add', time: Date.now() })
      if (data.logs.length > 80) data.logs = data.logs.slice(0, 80)
    }

    if (action === 'add_item') {
      const { sid, name, qty, unit } = payload
      const sec = data.sections.find(s => s.id === sid)
      if (!sec) return res.status(404).json({ error: 'section not found' })
      const newId = 'c' + Date.now()
      sec.items.push({ id: newId, name, qty, unit })
      data.logs.unshift({ name, qty, added: qty, type: 'add', time: Date.now() })
      if (data.logs.length > 80) data.logs = data.logs.slice(0, 80)
    }

    await kv.set('fridge_data', data)
    return res.json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
