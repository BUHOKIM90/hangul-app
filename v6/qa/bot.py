import asyncio, sys, json, time, random
from playwright.async_api import async_playwright
URL='http://localhost:8765/index.html'
PATCH = r"""
(()=>{ window.__sync=[]; window.__pv=[];
 const A=window.A, UI=window.UI, D=window.D;
 const praiseClips=new Set(Object.values(D.PRAISE_VOICE).map(p=>p[1]));
 const orig=A.play;
 A.play=function(k,opt){ opt=opt||{}; const o=Object.assign({},opt); const tap=UI.lastTapTime;
   if(opt.onStart){ o.onStart=(when)=>{ window.__sync.push({k, d: (A.heardNow()-when)*1000, perf: performance.now()}); opt.onStart(when); }; }
   else if(praiseClips.has(k)){ o.onStart=()=>{ window.__pv.push(performance.now()-tap); }; }
   return orig.call(A,k,o); };
})();
"""
async def act(pg):
  try:
    return await act2(pg)
  except Exception as e:
    print('act err',str(e)[:120]); return 'wait'
async def act2(pg):
    s = await pg.evaluate("""()=>{
      const q=s=>document.querySelector(s);
      if(q('.modal .mbtn')) return 'modal';
      if(q('.gift-box')) return 'gift';
      if(q('.intro .next-btn')) return 'intro';
      if(q('.chest:not(.open)')) return 'chest';
      if(q('.meet .next-btn:not([hidden])')) return 'meet';
      if(q('.write-board:not(.done)') && window.__board && window.__board.wrap.isConnected) return 'write';
      if(q('.mem')) return 'mem';
      if(q('.drum.next')) return 'drum';
      if(q('.vblock.next')) return 'vnext';
      if(window.__answer!=null){ const a=window.__answer; const n=a.startsWith('i')&&q('.cell')? q('.cell[data-i="'+a.slice(1)+'"]') : [...document.querySelectorAll('[data-v]')].find(x=>x.dataset.v===a && x.style.visibility!=='hidden'); if(n) return 'answer'; }
      return 'wait'; }""")
    if s=='modal': await pg.locator('.modal .mbtn').first.dispatch_event('pointerdown')
    elif s=='gift': await pg.locator('.gift-box').dispatch_event('pointerdown')
    elif s=='intro': await pg.locator('.intro .next-btn').dispatch_event('pointerdown')
    elif s=='chest': await pg.locator('.chest').dispatch_event('pointerdown')
    elif s=='meet': await pg.locator('.meet .next-btn').dispatch_event('pointerdown')
    elif s=='drum': await pg.locator('.drum').dispatch_event('pointerdown')
    elif s=='vnext': await pg.locator('.vblock.next').first.dispatch_event('pointerdown')
    elif s=='answer':
        # sometimes tap a wrong one first to exercise feedback
        if random.random()<0.15:
            await pg.evaluate("""()=>{const a=window.__answer;const w=[...document.querySelectorAll('[data-v],.cell')].find(x=>(x.dataset.v||'i'+x.dataset.i)!==a);if(w){const r=w.getBoundingClientRect();w.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.x+5,clientY:r.y+5}))}}""")
            await pg.wait_for_timeout(500)
        await pg.evaluate("""()=>{const a=window.__answer;const q=s=>document.querySelector(s);const n=a.startsWith('i')&&q('.cell')? q('.cell[data-i="'+a.slice(1)+'"]') : [...document.querySelectorAll('[data-v]')].find(x=>x.dataset.v===a && x.style.visibility!=='hidden');if(!n)return;const r=n.getBoundingClientRect();n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))}""")
    elif s=='mem':
        await pg.evaluate("""async()=>{const cs=[...document.querySelectorAll('.mcard:not(.matched)')]; if(!cs.length) return; const k=cs[0].dataset.k; const pair=cs.filter(c=>c.dataset.k===k); for(const c of pair){const r=c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.x+5,clientY:r.y+5})); await new Promise(r=>setTimeout(r,350));}}""")
    elif s=='write':
        info = await pg.evaluate("""()=>{const b=window.__board; const c=b.wrap.querySelector('.write-ink').getBoundingClientRect(); const sc=b._test.size()/100; const ss=b._test.samples(); const strokes={}; ss.forEach(p=>{(strokes[p.s]=strokes[p.s]||[]).push([c.x+p.x*sc,c.y+p.y*sc])}); return Object.values(strokes)}""")
        for st in info:
            await pg.mouse.move(st[0][0]+1, st[0][1]+1); await pg.mouse.down()
            for x,y in st[1:]: await pg.mouse.move(x+random.uniform(-3,3), y+random.uniform(-3,3), steps=1)
            await pg.mouse.up()
            await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(300)
    if s!='wait': await pg.wait_for_timeout(250)
    return s

import os
VW=int(os.environ.get('VW','1180')); VH=int(os.environ.get('VH','820')); TAG=os.environ.get('TAG','')
async def run_stage(b, sid, w=None, h=None):
    w=w or VW; h=h or VH
    ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=True)
    pg = await ctx.new_page()
    errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(400)
    await pg.dispatch_event('.splash-go','pointerdown'); await pg.wait_for_timeout(700)
    for i in range(4):
        if await pg.locator('.modal .mbtn').count(): await pg.locator('.modal .mbtn').first.dispatch_event('pointerdown'); await pg.wait_for_timeout(400)
    await pg.evaluate(PATCH)
    if sid==0: await pg.evaluate("()=>{App.giftRate=0.5; St.setStage(40); App.runStage({id:0,w:3,k:'review',title:'복습 모험'});}")
    else: await pg.evaluate(f"()=>{{App.giftRate=0.5; St.setStage({sid}); App.runStage(D.STAGES[{sid}-1]);}}")
    t0=time.time(); kinds=set(); n=0; shots=0
    while time.time()-t0<240:
        scr = await pg.evaluate("()=>App.screen")
        if scr=='home' and n>3: break
        play = await pg.evaluate("()=>{const p=document.querySelector('.play');return p?p.dataset.play:''}")
        if play and play not in kinds:
            kinds.add(play); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'/home/claude/qa/{TAG}st{sid}_{len(kinds)}_{play}.png'); shots+=1
        a = await act(pg); n+=1
        if a=='wait': await pg.wait_for_timeout(200)
    res = await pg.evaluate("()=>({stage:St.s.learn.stage, done:Object.keys(St.s.learn.done), score:St.s.learn.score, lat:UI.praiseStats.latencies, hist:UI.praiseStats.history, sync:window.__sync, pv:UI.praiseStats.voice, miss:A.log.filter(x=>typeof x==='string'), stickers:St.stickerCount(), stars:St.s.reward.stars})")
    await ctx.close()
    hist=res['hist']; rep=sum(1 for i in range(1,len(hist)) if hist[i]==hist[i-1])
    sd=[x['d'] for x in res['sync'] if x['d'] is not None]
    out=dict(sid=sid, secs=round(time.time()-t0), finished=(str(sid) in res['done']) if sid else True, plays=sorted(kinds), errs=errs[:4], miss=res['miss'][:5],
      praise_n=len(hist), praise_kinds=len(set(hist)), consecutive_repeat=rep, lat_max=max(res['lat'] or [0]), lat_all=res['lat'], voice_praise_ms_max=round(max(res['pv'] or [0])),
      sync_n=len(sd), sync_min=round(min(sd or [0]),1), sync_max=round(max(sd or [0]),1), score=res['score'].get(str(sid)), stickers=res['stickers'])
    print(json.dumps(out, ensure_ascii=False)); sys.stdout.flush()
    return out

async def main():
    ids=[int(x) for x in sys.argv[1:]]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--no-sandbox'])
        sem=asyncio.Semaphore(int(os.environ.get('PAR','4')))
        async def one(i):
            async with sem: return await run_stage(b,i)
        res=await asyncio.gather(*[one(i) for i in ids])
        json.dump(res, open('/home/claude/qa/bot_result.json','w'), ensure_ascii=False, indent=1)
        await b.close()
asyncio.run(main())
