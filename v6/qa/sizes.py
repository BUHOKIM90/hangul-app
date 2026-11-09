import asyncio, json
from playwright.async_api import async_playwright
URL='http://localhost:8765/index.html'
JS="""()=>{const out={};document.querySelectorAll('.tap').forEach(e=>{const r=e.getBoundingClientRect(); if(!r.width||getComputedStyle(e).visibility==='hidden')return; const c=(e.className.split(' ').find(x=>x!=='tap')||'tap'); const m=Math.min(r.width,r.height); if(!(c in out)||m<out[c]) out[c]=Math.round(m)}); return out}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        for name,(w,h) in {'phoneP':(375,667),'phoneL':(667,375),'ipadP':(768,1024)}.items():
            ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=True); pg=await ctx.new_page()
            await pg.goto(URL); await pg.wait_for_timeout(300); res={'splash':await pg.evaluate(JS)}
            await pg.dispatch_event('.splash-go','pointerdown'); await pg.wait_for_timeout(700)
            for i in range(4):
                if await pg.locator('.modal .mbtn').count(): res.setdefault('modal',await pg.evaluate(JS)); await pg.locator('.modal .mbtn').first.dispatch_event('pointerdown'); await pg.wait_for_timeout(300)
            res['home']=await pg.evaluate(JS)
            await pg.evaluate("()=>App.closet()"); await pg.wait_for_timeout(200); res['closet']=await pg.evaluate(JS)
            await pg.evaluate("()=>App.stickers()"); await pg.wait_for_timeout(200); res['book']=await pg.evaluate(JS)
            allmin={}
            for k,v in res.items():
                for c,m in v.items(): allmin[c]=min(m,allmin.get(c,9999))
            print(name, json.dumps(dict(sorted(allmin.items(), key=lambda x:x[1])), ensure_ascii=False))
            await ctx.close()
        await b.close()
asyncio.run(main())
