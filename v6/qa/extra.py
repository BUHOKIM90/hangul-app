import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':1180,'height':820},has_touch=True)).new_page()
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(400)
        await pg.dispatch_event('.splash-go','pointerdown'); await pg.wait_for_timeout(600)
        await pg.evaluate("()=>{document.querySelectorAll('.modal').forEach(m=>m.remove()); St.s.reward.level=6; for(let i=0;i<14;i++) St.pickSticker(); St.save(); App.stickers()}"); await pg.wait_for_timeout(700)
        await pg.screenshot(path='/home/claude/blind/screens/21_sticker_book.png')
        await pg.evaluate("()=>App.playground()"); await pg.wait_for_timeout(700)
        await pg.screenshot(path='/home/claude/blind/screens/23_playground.png')
        await b.close()
asyncio.run(main())
