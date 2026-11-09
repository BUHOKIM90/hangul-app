import asyncio, sys, json
from playwright.async_api import async_playwright
URL='http://localhost:8765/index.html'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--no-sandbox'])
        for name,(w,h,touch) in {'ipad_land':(1180,820,True),'ipad_port':(820,1180,True),'phone_port':(390,844,True),'phone_land':(844,390,True)}.items():
            ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=touch, device_scale_factor=1)
            pg = await ctx.new_page()
            errs=[]
            pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
            pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
            await pg.goto(URL); await pg.wait_for_timeout(600)
            await pg.screenshot(path=f'/home/claude/qa/shot_{name}_0splash.png')
            await pg.dispatch_event('.splash-go','pointerdown')
            await pg.wait_for_timeout(900)
            # close daily modal(s)
            for i in range(3):
                if await pg.locator('.modal .mbtn').count():
                    await pg.screenshot(path=f'/home/claude/qa/shot_{name}_1modal{i}.png')
                    await pg.locator('.modal .mbtn').first.dispatch_event('pointerdown'); await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'/home/claude/qa/shot_{name}_2home.png')
            # overflow check
            ov = await pg.evaluate("()=>{const r=[];document.querySelectorAll('#main *').forEach(e=>{const b=e.getBoundingClientRect(); if(b.width&&(b.right>innerWidth+2||b.bottom>innerHeight+2||b.left<-2)) r.push(e.className+':'+Math.round(b.right)+'x'+Math.round(b.bottom))});return r.slice(0,8)}")
            print(name,'errors',errs[:5],'overflow',ov)
            await ctx.close()
        await b.close()
asyncio.run(main())
