"""Draw extra dress-up layers (SVG, 512 canvas) from each character's anchors and add them to the manifest.
Idempotent: items with ids already present are replaced."""
import json, math, os
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
man_p = os.path.join(root, 'assets/dress/manifest.json')
man = json.load(open(man_p))
INK = '#6B5040'
def svg(body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n' + body + '\n</svg>\n'
def flower(x, y, r, petal, core):
    out = []
    for k in range(5):
        a = k * 72 * math.pi / 180
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="%s" stroke-width="2.5"/>' % (x + math.cos(a) * r, y + math.sin(a) * r, r * 0.85, petal, INK))
    out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="%s" stroke-width="2.5"/>' % (x, y, r * 0.7, core, INK))
    return ''.join(out)
def items_for(cid, hc, neck):
    hx, hy = hc
    nx, ny = neck
    top = hy - 104   # crown of the head
    it = {}
    # hats
    it['hat_ribbon'] = ('리본 머리띠', svg(
        '<path d="M%d %d q%d -%d %d 0" fill="none" stroke="#F27BA6" stroke-width="10" stroke-linecap="round"/>' % (hx - 70, top + 34, 70, 44, 140) +
        '<g transform="translate(%d %d)" stroke="%s" stroke-width="3" stroke-linejoin="round">'
        '<path d="M0 0 L-34 -20 Q-44 0 -34 20 Z" fill="#FF9FC0"/><path d="M0 0 L34 -20 Q44 0 34 20 Z" fill="#FF9FC0"/>'
        '<circle r="9" fill="#F27BA6"/></g>' % (hx + 44, top + 22, INK)))
    it['hat_flowers'] = ('꽃 화관', svg(
        '<path d="M%d %d Q%d %d %d %d" fill="none" stroke="#8FCBB0" stroke-width="7" stroke-linecap="round"/>' % (hx - 78, top + 40, hx, top - 6, hx + 78, top + 40) +
        flower(hx - 62, top + 30, 10, '#FFD0E0', '#F2C14E') + flower(hx - 22, top + 12, 11, '#FFF4C8', '#F4A3C2') +
        flower(hx + 22, top + 12, 11, '#D5EBFF', '#F2C14E') + flower(hx + 62, top + 30, 10, '#F0E4FF', '#F4A3C2')))
    it['hat_party'] = ('고깔모자', svg(
        '<g stroke="%s" stroke-width="3" stroke-linejoin="round"><path d="M%d %d L%d %d L%d %d Z" fill="#8EB7E0"/>' % (INK, hx - 38, top + 26, hx + 6, top - 66, hx + 42, top + 22) +
        '<path d="M%d %d L%d %d" stroke="#FFF4C8" stroke-width="7"/><path d="M%d %d L%d %d" stroke="#FFF4C8" stroke-width="7"/>' % (hx - 22, top - 2, hx + 22, top - 6, hx - 8, top - 32, hx + 14, top - 34) +
        '<circle cx="%d" cy="%d" r="11" fill="#F2C14E"/></g>' % (hx + 6, top - 70)))
    # accessories at the neck
    it['acc_heart'] = ('하트 목걸이', svg(
        '<path d="M%d %d Q%d %d %d %d" fill="none" stroke="#F2C14E" stroke-width="5"/>' % (nx - 46, ny - 10, nx, ny + 34, nx + 46, ny - 10) +
        '<g transform="translate(%d %d)" stroke="%s" stroke-width="3" stroke-linejoin="round"><path d="M0 14 C-22 0 -18 -16 -8 -16 C-3 -16 0 -12 0 -9 C0 -12 3 -16 8 -16 C18 -16 22 0 0 14 Z" fill="#F27BA6"/></g>' % (nx, ny + 22, INK)))
    it['acc_scarf'] = ('줄무늬 목도리', svg(
        '<g stroke="%s" stroke-width="3" stroke-linejoin="round"><path d="M%d %d Q%d %d %d %d L%d %d Q%d %d %d %d Z" fill="#F07A58"/>' % (INK, nx - 66, ny - 14, nx, ny + 22, nx + 66, ny - 14, nx + 62, ny + 8, nx, ny + 44, nx - 62, ny + 8) +
        '<path d="M%d %d l-6 58 l26 0 l4 -52 Z" fill="#F07A58"/>' % (nx + 26, ny + 22) +
        '<path d="M%d %d l-2 18 M%d %d l-2 18 M%d %d l-2 18" stroke="#FFF4C8" stroke-width="6"/></g>' % (nx - 30, ny + 6, nx, ny + 12, nx + 30, ny + 6)))
    it['acc_bowtie'] = ('나비넥타이', svg(
        '<g transform="translate(%d %d)" stroke="%s" stroke-width="3" stroke-linejoin="round"><path d="M0 0 L-30 -18 L-30 18 Z" fill="#7B5BD6"/><path d="M0 0 L30 -18 L30 18 Z" fill="#7B5BD6"/><rect x="-8" y="-9" width="16" height="18" rx="5" fill="#B9A4E8"/></g>' % (nx, ny + 8, INK)))
    return it
BGS = [('bg_night', '별밤', 'radial-gradient(circle at 20% 22%, #FFF4C8 0 2%, transparent 3%), radial-gradient(circle at 78% 30%, #FFF4C8 0 1.6%, transparent 2.6%), radial-gradient(circle at 60% 12%, #FFF 0 1.2%, transparent 2%), linear-gradient(180deg, #5B6FB8 0%, #8EA6E0 70%, #C9D6F4 100%)'),
       ('bg_rainbow', '무지개', 'radial-gradient(circle at 50% 100%, transparent 0 34%, #B9A4E8 34% 38%, #8EB7E0 38% 42%, #8FCBB0 42% 46%, #F2C14E 46% 50%, #F4B59A 50% 54%, transparent 54%), linear-gradient(180deg, #E6F5FF, #FFF8EC)'),
       ('bg_sea', '바닷가', 'linear-gradient(180deg, #D5EBFF 0 48%, #8EC8E8 48% 70%, #F6E2B8 70% 100%)'),
       ('bg_garden', '꽃밭', 'radial-gradient(circle at 18% 82%, #FFD0E0 0 4%, transparent 5%), radial-gradient(circle at 80% 86%, #FFF4C8 0 4%, transparent 5%), radial-gradient(circle at 50% 92%, #F0E4FF 0 4%, transparent 5%), linear-gradient(180deg, #F4FFF8 0 62%, #BFE3B0 62% 100%)')]
new_ids = []
for ch in man['characters']:
    cid = ch['id']
    a = json.load(open(os.path.join(root, 'assets/friends/anchors/%s.json' % cid)))['anchors']
    for key, (label, body) in items_for(cid, a['head_center']['px'], a['neck']['px']).items():
        slot, name = key.split('_', 1)
        rel = 'assets/dress/layers/%s_%s.svg' % (cid, key)
        open(os.path.join(root, rel), 'w').write(body)
        new_ids.append(dict(id='%s_%s' % (cid, key), character=cid, slot=slot, name=name, label=label, file=rel, starter=False, extra='svg'))
    for key, label, bg in BGS:
        new_ids.append(dict(id='%s_%s' % (cid, key), character=cid, slot='bg', name=key[3:], label=label, paint={'type': 'css', 'background': bg}, extra='color', starter=False))
ids = {i['id'] for i in new_ids}
man['items'] = [i for i in man['items'] if i['id'] not in ids] + new_ids
man['unlock'] = [u for u in man['unlock'] if u not in ids]
# unlock order: interleave new items so every character gets something soon
order = sorted(new_ids, key=lambda i: (['hat', 'acc', 'bg'].index(i['slot']), i['character']))
man['unlock'] += [i['id'] for i in order]
json.dump(man, open(man_p, 'w'), ensure_ascii=False, indent=1)
print('items', len(man['items']), 'unlock', len(man['unlock']))
