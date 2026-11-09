import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        for name,(w,h) in {'L':(1180,820),'P':(390,844)}.items():
            pg = await (await b.new_context(viewport={'width':w,'height':h},has_touch=True)).new_page()
            errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(400)
            await pg.dispatch_event('.splash-go','pointerdown'); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'lk_{name}_0gift.png')
            for i in range(4):
                if await pg.locator('.modal .mbtn').count(): await pg.locator('.modal .mbtn').first.dispatch_event('pointerdown'); await pg.wait_for_timeout(300)
            await pg.evaluate("()=>{St.s.reward.level=5; St.setStage(18); St.save(); App.home()}"); await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'lk_{name}_1home.png')
            for sid in [18, 66, 12]:
                await pg.evaluate(f"()=>{{App.runStage(D.STAGES[{sid}-1]);}}"); await pg.wait_for_timeout(900)
                if await pg.locator('.intro .next-btn').count(): await pg.locator('.intro .next-btn').dispatch_event('pointerdown')
                await pg.wait_for_timeout(5500); await pg.screenshot(path=f'lk_{name}_st{sid}.png')
            await pg.evaluate("()=>{UI.praise('pick')}"); await pg.wait_for_timeout(300); await pg.screenshot(path=f'lk_{name}_praise.png')
            print(name, errs)
        await b.close()
asyncio.run(main())
