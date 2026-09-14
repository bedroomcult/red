export function predict(starts: string[], opts: {ecType?: string|null, bcMode?: boolean}) {
  if (opts.bcMode) return { next: null, lo: null, hi: null, ov: null, confidence: 'suppressed' as const, flags: ['bc-suppressed'] };
  const ds = starts.map(s => Date.parse(s+'T00:00:00Z'));
  if (ds.length < 2) return { next: null, lo: null, hi: null, ov: null, confidence: 'low' as const, flags: ['need-more-data'] };
  let cycles: number[] = [];
  for (let i=1;i<ds.length;i++) cycles.push(Math.round((ds[i]-ds[i-1])/86400000));
  cycles = cycles.slice(-6);
  const mean = (a:number[])=>a.reduce((x,y)=>x+y,0)/a.length;
  let avg = mean(cycles);
  let sd = Math.sqrt(mean(cycles.map(c=>(c-avg)**2)));
  if (cycles.length>=4) { const out = cycles.filter(c=>Math.abs(c-avg)>2*sd); if (out.length===1) { cycles = cycles.filter(c=>c!==out[0]); avg = mean(cycles); sd = Math.sqrt(mean(cycles.map(c=>(c-avg)**2))); } }
  const last = ds[ds.length-1];
  const next = new Date(last + Math.round(avg)*86400000).toISOString().slice(0,10);
  let w = Math.max(Math.round(sd),2);
  if (opts.ecType==='LNG') w = 7;
  if (opts.ecType==='UPA') w = 10;
  const lo = new Date(Date.parse(next)-w*86400000).toISOString().slice(0,10);
  const hi = new Date(Date.parse(next)+w*86400000).toISOString().slice(0,10);
  const ov = opts.ecType ? null : new Date(Date.parse(next)-14*86400000).toISOString().slice(0,10);
  const confidence = (opts.ecType?'low':sd<2?'high':sd<4?'med':'low') as any;
  const flags:string[] = [];
  const range = Math.max(...cycles)-Math.min(...cycles);
  if (range>9) flags.push('irregular');
  if (opts.ecType) flags.push('ec-disrupted');
  return { next, lo, hi, ov, confidence, flags };
}
