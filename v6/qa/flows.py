import asyncio, json, re
from playwright.async_api import async_playwright
URL='http://localhost:8765/index.html'
async def start(pg):
    await pg.goto(URL); await pg.wait_for_timeout(400)
    await pg.dispatch_event('.splash-go','pointerdown'); await pg.wait_for_timeout(700)
    for i in range(4):
        if await pg.locator('.modal .mbtn').count(): await pg.locator('.modal .mbtn').first.dispatch_event('pointerdown'); await pg.wait_for_timeout(400)
async def main():
    R={}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1180,'height':820}, has_touch=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await start(pg)
        await pg.evaluate("""()=>{for(let i=0;i<6;i++)St.pickSticker(); St.giveOutfit(); St.giveOutfit(); St.s.reward.wear={hat:St.s.reward.outfits[0]};
          for(let i=1;i<20;i++){St.s.learn.done[i]=1; St.s.learn.score[i]={right:9,wrong:1,date:'2026-11-08'};} St.s.learn.stage=20; St.s.reward.stars=77; St.save(); App.home();}""")
        await pg.wait_for_timeout(300)
        before = await pg.evaluate("()=>({stk:St.stickerCount(), out:St.s.reward.outfits.length, stage:St.s.learn.stage, done:Object.keys(St.s.learn.done).length, stars:St.s.reward.stars})")
        # kid zoom guard
        R['kid_meta'] = await pg.evaluate("()=>document.querySelector('meta[name=viewport]').content")
        R['kid_gesture_blocked'] = await pg.evaluate("()=>{const e=new Event('gesturestart',{cancelable:true,bubbles:true}); document.body.dispatchEvent(e); return e.defaultPrevented}")
        R['kid_pinch_blocked'] = await pg.evaluate("()=>{const t1=new Touch({identifier:1,target:document.body,clientX:10,clientY:10}),t2=new Touch({identifier:2,target:document.body,clientX:50,clientY:50}); const e=new TouchEvent('touchmove',{cancelable:true,bubbles:true,touches:[t1,t2]}); document.body.dispatchEvent(e); return e.defaultPrevented}")
        # short tap on lock must NOT open
        await pg.dispatch_event('.hud-lock','pointerdown'); await pg.wait_for_timeout(500); await pg.dispatch_event('.hud-lock','pointerup'); await pg.wait_for_timeout(2000)
        R['short_press_opens'] = await pg.locator('.gate-m').count()>0
        # long press
        await pg.dispatch_event('.hud-lock','pointerdown'); await pg.wait_for_timeout(2300)
        R['long_press_gate'] = await pg.locator('.gate-m').count()>0
        q = await pg.locator('.gate b').inner_text(); a,c = map(int, re.findall(r'\d+', q)[:2])
        await pg.locator('.gate-m .mbtn', has_text=re.compile('^'+str(a+c)+'$')).dispatch_event('pointerdown'); await pg.wait_for_timeout(500)
        R['parent_open'] = await pg.locator('#parent .pm').count()>0
        R['adult_meta'] = await pg.evaluate("()=>document.querySelector('meta[name=viewport]').content")
        R['adult_gesture_blocked'] = await pg.evaluate("()=>{const e=new Event('gesturestart',{cancelable:true,bubbles:true}); document.body.dispatchEvent(e); return e.defaultPrevented}")
        await pg.screenshot(path='/home/claude/qa/parent.png', full_page=False)
        await pg.click('#pmCheck'); await pg.wait_for_timeout(300)
        for i in range(47):
            if not await pg.locator('.check .yes').count(): break
            await pg.click('.check .yes' if i%3 else '.check .no')
        await pg.wait_for_timeout(400)
        R['reading_check'] = await pg.evaluate("()=>St.s.learn.checks")
        R['check_table_rows'] = await pg.locator('#parent .pm-table').count()
        await pg.click('#pmResetR'); await pg.wait_for_timeout(400)
        R['reset_msg'] = await pg.locator('#pmMsg').inner_text()
        after = await pg.evaluate("()=>({stk:St.stickerCount(), out:St.s.reward.outfits.length, wear:Object.keys(St.s.reward.wear).length, stage:St.s.learn.stage, done:Object.keys(St.s.learn.done).length, stars:St.s.reward.stars})")
        await pg.click('#pmClose'); await pg.wait_for_timeout(400)
        R['closed_meta'] = await pg.evaluate("()=>document.querySelector('meta[name=viewport]').content")
        R['closed_adult_class'] = await pg.evaluate("()=>document.documentElement.classList.contains('adult')")
        await pg.reload(); await pg.wait_for_timeout(500)
        persisted = await pg.evaluate("()=>({stk:St.stickerCount(), stage:St.s.learn.stage, done:Object.keys(St.s.learn.done).length})")
        R['before']=before; R['after']=after; R['after_reload']=persisted; R['errs']=errs
        await ctx.close()
        # offline
        ctx = await b.new_context(viewport={'width':820,'height':1180}, has_touch=True, service_workers='allow')
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL)
        n=0; want=await pg.evaluate("()=>window.SW_FILES_COUNT")
        for i in range(60):
            n = await pg.evaluate("async()=>{const k=(await caches.keys()).find(x=>x.startsWith('hangul-v6')); if(!k) return 0; return (await (await caches.open(k)).keys()).length}")
            if n>=want: break
            await pg.wait_for_timeout(1000)
        R['cached']=f'{n}/{want}'
        await pg.reload(); await pg.wait_for_timeout(800)
        R['sw_controls'] = await pg.evaluate("()=>!!navigator.serviceWorker.controller")
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(800)
        await start(pg)
        await pg.evaluate("()=>{St.setStage(16); App.runStage(D.STAGES[15]);}")
        await pg.wait_for_timeout(1500)
        await pg.locator('.intro .next-btn').dispatch_event('pointerdown'); await pg.wait_for_timeout(4500)
        R['offline_play'] = await pg.evaluate("()=>({screen:App.screen, play:document.querySelector('.play').dataset.play, missing:A.log.filter(x=>typeof x==='string'), played:A.log.filter(x=>x.key).map(x=>x.key)})")
        R['offline_errs']=errs
        await pg.screenshot(path='/home/claude/qa/offline.png')
        await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1))
asyncio.run(main())
