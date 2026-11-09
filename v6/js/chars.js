'use strict';
/* 한글 별 요정 — flat Sanrio-like style: solid fills, one warm outline, small shiny eyes, a signature item each,
   a letter gem on the forehead. Original designs. viewBox 0 0 200 312. */
(function (G) {
  const LINE = '#4B3642';
  const C = {};
  const SPEC = {
    lumi:  { name: '별사탕 공주 루미', gem: 'ㅎ', body: '#FFE9DE', dress: '#D7C6FF', hair: '#FF9CC8', gemC: '#FF5C9E' },
    tori:  { name: '구름토끼 토리', gem: 'ㄱ', body: '#FFFFFF', inner: '#FFC2D6', gemC: '#7CC8FF' },
    kong:  { name: '아기용 콩이', gem: 'ㄴ', body: '#A9EBCF', belly: '#FFF3CF', gemC: '#FFB443' },
    mong:  { name: '솜사탕양 몽글이', gem: 'ㅏ', body: '#FFE9F2', face: '#FFF4E6', gemC: '#B48CFF' },
    pomi:  { name: '리본고양이 뽀미', gem: 'ㅁ', body: '#E4DAFF', inner: '#FFC2D6', gemC: '#FF5C93' },
    piyak: { name: '병아리 삐약이', gem: 'ㅇ', body: '#FFE873', gemC: '#5FC2FF' },
    bori:  { name: '꿀곰 보리', gem: 'ㅂ', body: '#E8B98A', inner: '#FFE7C9', gemC: '#7FD18B' },
    dori:  { name: '바둑강아지 도리', gem: 'ㄷ', body: '#FFF6EA', inner: '#C99B7A', gemC: '#FF9548' },
    sori:  { name: '꼬리여우 소리', gem: 'ㅅ', body: '#FFB27A', inner: '#FFF6EA', gemC: '#4FB8FF' },
    pang:  { name: '대나무판다 팡팡', gem: 'ㅈ', body: '#FFFFFF', inner: '#5B4A57', gemC: '#5CC98A' },
    yuni:  { name: '무지개유니콘 유니', gem: 'ㅊ', body: '#FFFFFF', inner: '#FFC2D6', gemC: '#A77BFF' }
  };
  C.SPEC = SPEC;
  C.ALIAS = { mong: 'mong', rabbit: 'tori', bear: 'bori', cat: 'pomi', chick: 'piyak', puppy: 'dori', fox: 'sori', panda: 'pang' };
  const sw = (w) => `stroke="${LINE}" stroke-width="${w || 4.2}" stroke-linejoin="round" stroke-linecap="round"`;
  function star(x, y, r, fill) {
    const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r; p.push((x + Math.cos(a) * rr).toFixed(1) + ' ' + (y + Math.sin(a) * rr).toFixed(1)); }
    return `<path d="M${p.join(' L')}Z" fill="${fill}" ${sw(3)}/>`;
  }
  function eyes(mood, y) {
    const one = (x, dir) => {
      if (mood === 'joy' || mood === 'cheer') return `<path d="M${x - 8} ${y + 2} Q${x} ${y - 8} ${x + 8} ${y + 2}" fill="none" ${sw(4.4)}/>`;
      if (mood === 'wink' && dir < 0) return `<path d="M${x - 8} ${y} Q${x} ${y - 7} ${x + 8} ${y}" fill="none" ${sw(4.4)}/>`;
      if (mood === 'think') return `<ellipse cx="${x}" cy="${y + 2}" rx="5.4" ry="5.4" fill="${LINE}"/><circle cx="${x - 1.6}" cy="${y}" r="1.8" fill="#fff"/>`;
      const s = mood === 'wow' ? 1.25 : 1;
      return `<g class="eye"><ellipse cx="${x}" cy="${y}" rx="${6.6 * s}" ry="${9 * s}" fill="${LINE}"/><ellipse cx="${x - 1.8 * dir * -1 - 1.6}" cy="${y - 3.4 * s}" rx="${2.6 * s}" ry="${3.2 * s}" fill="#fff"/><circle cx="${x + 2}" cy="${y + 4 * s}" r="${1.2 * s}" fill="#fff"/></g>`;
    };
    return `<g class="eyes blinker">${one(74, -1)}${one(126, 1)}</g>`;
  }
  function mouth(mood, y) {
    if (mood === 'joy' || mood === 'cheer') return `<path d="M92 ${y - 1} Q100 ${y + 12} 108 ${y - 1}Z" fill="#FF6F8E" ${sw(3.2)}/>`;
    if (mood === 'wow') return `<ellipse cx="100" cy="${y + 3}" rx="4.6" ry="6" fill="#FF6F8E" ${sw(3.2)}/>`;
    if (mood === 'think') return `<path d="M95 ${y + 3} h10" fill="none" ${sw(3.4)}/>`;
    return `<path d="M93 ${y} q3.5 4.4 7 0 q3.5 4.4 7 0" fill="none" ${sw(3.2)}/>`;
  }
  const cheeks = y => `<ellipse cx="56" cy="${y}" rx="10" ry="6.4" fill="#FF9FB8" opacity=".75"/><ellipse cx="144" cy="${y}" rx="10" ry="6.4" fill="#FF9FB8" opacity=".75"/>`;
  function gem(sp, x, y) {
    return `<g class="gem"><circle cx="${x}" cy="${y}" r="19" fill="#fff" ${sw(3.4)}/><circle cx="${x}" cy="${y}" r="14.4" fill="none" stroke="${sp.gemC}" stroke-width="3"/>
      <text x="${x}" y="${y + 7.4}" text-anchor="middle" font-size="21" font-weight="900" fill="${sp.gemC}" font-family="'Jua','Apple SD Gothic Neo','Noto Sans KR',sans-serif">${sp.gem}</text>
      <circle cx="${x - 10}" cy="${y - 10}" r="2.6" fill="#fff"/></g>`;
  }
  /* body + limbs common to the animal friends */
  function bodyRig(fill, mood, extra, feet, skirt) {
    const up = mood === 'cheer' || mood === 'joy';
    const raise = (x, dir) => `<path d="M${100 + dir * 36} 214 C${100 + dir * 48} 206 ${100 + dir * 54} 194 ${100 + dir * 54} 184" fill="none" ${sw(17)}/><path d="M${100 + dir * 36} 214 C${100 + dir * 48} 206 ${100 + dir * 54} 194 ${100 + dir * 54} 184" fill="none" stroke="${fill}" stroke-width="9.6" stroke-linecap="round"/>`;
    if (mood === 'wave') return `<ellipse cx="82" cy="268" rx="15" ry="9" fill="${feet || fill}" ${sw()}/><ellipse cx="118" cy="268" rx="15" ry="9" fill="${feet || fill}" ${sw()}/>
      ${skirt || `<path d="M62 200 C56 226 62 266 100 266 C138 266 144 226 138 200Z" fill="${fill}" ${sw()}/>`}${extra || ''}<ellipse cx="60" cy="230" rx="9" ry="12" transform="rotate(28 60 230)" fill="${fill}" ${sw()}/>${raise(0, 1)}`;
    const arms = up
      ? `<path d="M64 214 C52 206 46 194 46 184" fill="none" ${sw(17)}/><path d="M64 214 C52 206 46 194 46 184" fill="none" stroke="${fill}" stroke-width="9.6" stroke-linecap="round"/>
         <path d="M136 214 C148 206 154 194 154 184" fill="none" ${sw(17)}/><path d="M136 214 C148 206 154 194 154 184" fill="none" stroke="${fill}" stroke-width="9.6" stroke-linecap="round"/>`
      : `<ellipse cx="60" cy="230" rx="9" ry="12" transform="rotate(28 60 230)" fill="${fill}" ${sw()}/><ellipse cx="140" cy="230" rx="9" ry="12" transform="rotate(-28 140 230)" fill="${fill}" ${sw()}/>`;
    return `<ellipse cx="82" cy="268" rx="15" ry="9" fill="${feet || fill}" ${sw()}/><ellipse cx="118" cy="268" rx="15" ry="9" fill="${feet || fill}" ${sw()}/>
      ${skirt || `<path d="M62 200 C56 226 62 266 100 266 C138 266 144 226 138 200Z" fill="${fill}" ${sw()}/>`}${extra || ''}${arms}`;
  }
  const HEAD = 'M100 92 C150 92 176 122 176 158 C176 192 146 210 100 210 C54 210 24 192 24 158 C24 122 50 92 100 92Z';
  C.draw = function (k, mood, wear, out) {
    mood = mood || 'happy'; out = out || {};
    if (!SPEC[k]) k = C.ALIAS[k] || 'lumi';
    const sp = SPEC[k] || SPEC.tori;
    const f = sp.body, tint = out.tint || f;
    let back = '', ears = '', head = `<path d="${HEAD}" fill="${f}" ${sw()}/>`, over = '', face = '', bodyExtra = '', eyeY = 160, mouthY = 178, gemY = 116;
    switch (k) {
      case 'lumi': {
        const H = sp.hair;
        back = `<path d="M40 150 C14 170 12 222 30 246 C40 232 50 236 54 244 C64 222 62 190 56 168Z" fill="${H}" ${sw()}/>
                <path d="M160 150 C186 170 188 222 170 246 C160 232 150 236 146 244 C136 222 138 190 144 168Z" fill="${H}" ${sw()}/>`;
        ears = `<path d="M100 84 C156 84 182 118 182 160 C182 176 176 190 168 198 L32 198 C24 190 18 176 18 160 C18 118 44 84 100 84Z" fill="${H}" ${sw()}/>
                <circle cx="34" cy="122" r="10" fill="#FFE066" ${sw(3)}/><circle cx="166" cy="122" r="10" fill="#FFE066" ${sw(3)}/>`;
        head = `<path d="M100 104 C146 104 166 132 166 162 C166 194 140 210 100 210 C60 210 34 194 34 162 C34 132 54 104 100 104Z" fill="${f}" ${sw()}/>`;
        over = `<path d="M38 150 C40 118 62 98 100 98 C138 98 160 118 162 150 C150 138 140 132 130 132 C126 140 118 144 110 140 C104 132 98 128 92 134 C86 144 74 142 70 132 C58 134 46 140 38 150Z" fill="${H}" ${sw()}/>
                <path d="M76 98 L82 70 L92 86 L100 62 L108 86 L118 70 L124 98Z" fill="#FFD95A" ${sw(3.6)}/><circle cx="100" cy="84" r="5" fill="#FF5C9E" ${sw(2.6)}/>
                <g transform="translate(150 132) rotate(-14)">${star(0, 0, 11, '#FFE066')}</g>`;
        face = ''; mouthY = 182; eyeY = 164;
        bodyExtra = `<path d="M56 266 C66 250 134 250 144 266" fill="#fff" opacity=".0"/>`;
        break;
      }
      case 'tori':
        back = `<path d="M136 252 c6 -12 24 -8 22 4 c10 4 6 18 -6 16 c-6 8 -20 4 -18 -6 c-8 -4 -4 -14 2 -14z" fill="#fff" ${sw()}/>`;
        ears = `<path d="M72 104 C60 70 58 34 72 28 C86 22 92 60 90 98Z" fill="${f}" ${sw()}/><path d="M74 96 C68 72 68 46 74 42 C80 40 84 66 84 92Z" fill="${sp.inner}"/>
                <path d="M118 98 C114 62 124 26 140 30 C156 34 146 74 130 104Z" fill="${f}" ${sw()}/><path d="M124 92 C122 66 128 44 138 46 C146 50 140 74 130 96Z" fill="${sp.inner}"/>`;
        over = `<g transform="translate(140 34) rotate(20)">${star(0, 0, 10, '#FFE066')}</g>`;
        face = `<path d="M96 168 h8 l-4 4z" fill="#FF8FB0" ${sw(2.4)}/>`; mouthY = 178;
        break;
      case 'kong':
        back = `<path d="M134 252 C160 256 176 244 180 226" fill="none" ${sw(16)}/><path d="M134 252 C160 256 176 244 180 226" fill="none" stroke="${f}" stroke-width="8.6" stroke-linecap="round"/>
                <path d="M180 214 l-9 -9 a6 6 0 0 1 9 -6 a6 6 0 0 1 9 6z" transform="translate(0 6) scale(1)" fill="#FF8FB0" ${sw(3)}/>
                <path d="M62 214 C38 196 26 214 34 230 C42 222 50 228 54 234 C58 226 62 228 66 232Z" fill="#CDB8FF" ${sw(3.6)}/><path d="M138 214 C162 196 174 214 166 230 C158 222 150 228 146 234 C142 226 138 228 134 232Z" fill="#CDB8FF" ${sw(3.6)}/>`;
        ears = `<path d="M66 104 C60 86 62 72 72 68 C78 80 82 92 84 100Z" fill="#FFF0C2" ${sw()}/><path d="M134 104 C140 86 138 72 128 68 C122 80 118 92 116 100Z" fill="#FFF0C2" ${sw()}/>
                <path d="M86 96 C88 82 96 78 100 76 C104 78 112 82 114 96Z" fill="#7FD9B4" ${sw(3.6)}/>`;
        bodyExtra = `<ellipse cx="100" cy="236" rx="24" ry="24" fill="${sp.belly}" ${sw(3)}/>`;
        face = `<circle cx="96" cy="170" r="1.8" fill="${LINE}"/><circle cx="104" cy="170" r="1.8" fill="${LINE}"/>`; mouthY = 180;
        break;
      case 'mong': {
        let wool = ''; [[46, 128], [60, 106], [82, 94], [106, 92], [130, 98], [150, 114], [160, 138], [38, 150], [162, 160], [40, 172]].forEach(([x, y]) => { wool += `<circle cx="${x}" cy="${y}" r="18" fill="${f}" ${sw()}/>`; });
        ears = `<ellipse cx="34" cy="164" rx="16" ry="9" transform="rotate(-20 34 164)" fill="${sp.face}" ${sw()}/><ellipse cx="166" cy="164" rx="16" ry="9" transform="rotate(20 166 164)" fill="${sp.face}" ${sw()}/>` + wool;
        head = `<path d="M100 108 C140 108 162 132 162 162 C162 192 136 208 100 208 C64 208 38 192 38 162 C38 132 60 108 100 108Z" fill="${sp.face}" ${sw()}/>`;
        over = `<path d="M70 118 c4 -10 16 -10 20 -2 c4 -8 16 -8 20 0 c4 -6 14 -4 16 4" fill="${f}" stroke="none"/>`;
        bodyExtra = `<path d="M64 206 q9 8 18 0 q9 8 18 0 q9 8 18 0 q9 8 18 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`;
        face = `<ellipse cx="100" cy="170" rx="4.6" ry="3.4" fill="#FF8FB0"/>`; gemY = 124; mouthY = 180;
        break;
      }
      case 'pomi':
        back = `<path d="M136 254 C170 258 178 226 162 216 C152 210 146 222 156 226" fill="none" ${sw(15)}/><path d="M136 254 C170 258 178 226 162 216 C152 210 146 222 156 226" fill="none" stroke="${f}" stroke-width="7.6" stroke-linecap="round"/>`;
        ears = `<path d="M34 134 L42 74 L86 98Z" fill="${f}" ${sw()}/><path d="M166 134 L158 74 L114 98Z" fill="${f}" ${sw()}/><path d="M46 118 L50 90 L70 102Z" fill="${sp.inner}"/><path d="M154 118 L150 90 L130 102Z" fill="${sp.inner}"/>`;
        over = `<g transform="translate(146 92) rotate(18)"><path d="M0 0 C-26 -22 -32 12 0 6 C32 12 26 -22 0 0Z" fill="#FF5C93" ${sw(3.6)}/><ellipse rx="7" ry="8" fill="#FF8FB0" ${sw(3.2)}/></g>`;
        face = `<path d="M96 167 h8 l-4 4.4z" fill="#FF8FB0" ${sw(2.2)}/><g ${sw(2.4)}><path d="M40 166 h-18 M42 176 l-17 5 M160 166 h18 M158 176 l17 5"/></g>`;
        break;
      case 'piyak':
        head = `<path d="M100 88 C146 88 174 122 174 160 C174 194 144 210 100 210 C56 210 26 194 26 160 C26 122 54 88 100 88Z" fill="${f}" ${sw()}/>`;
        ears = `<path d="M94 92 C84 68 100 62 100 86 C104 62 124 70 106 92Z" fill="${f}" ${sw()}/>`;
        face = `<path d="M88 168 L112 168 L100 182Z" fill="#FFA24C" ${sw(3)}/>`; mouthY = 999;
        bodyExtra = `<ellipse cx="100" cy="240" rx="22" ry="20" fill="#FFF6C8" stroke="none"/>`;
        break;
      case 'bori':
        back = `<circle cx="144" cy="252" r="9" fill="${f}" ${sw()}/>`;
        ears = `<circle cx="46" cy="106" r="20" fill="${f}" ${sw()}/><circle cx="154" cy="106" r="20" fill="${f}" ${sw()}/><circle cx="46" cy="106" r="10" fill="${sp.inner}"/><circle cx="154" cy="106" r="10" fill="${sp.inner}"/>`;
        face = `<ellipse cx="100" cy="176" rx="20" ry="14" fill="${sp.inner}" ${sw(3)}/><ellipse cx="100" cy="170" rx="7" ry="5" fill="${LINE}"/><ellipse cx="98" cy="168.6" rx="2.2" ry="1.4" fill="#fff"/>`; mouthY = 180;
        bodyExtra = `<ellipse cx="100" cy="240" rx="20" ry="18" fill="${sp.inner}" stroke="none"/>`;
        break;
      case 'dori':
        back = `<path d="M136 250 C150 244 156 230 152 220" fill="none" ${sw(14)}/><path d="M136 250 C150 244 156 230 152 220" fill="none" stroke="${f}" stroke-width="6.4" stroke-linecap="round"/>`;
        ears = `<path d="M44 108 C20 112 14 160 30 176 C42 186 54 168 58 128Z" fill="${sp.inner}" ${sw()}/><path d="M156 108 C180 112 186 160 170 176 C158 186 146 168 142 128Z" fill="${sp.inner}" ${sw()}/>`;
        over = `<path d="M118 120 C134 116 150 126 152 146 C140 150 124 144 118 130Z" fill="${sp.inner}" opacity=".9"/>`;
        face = `<ellipse cx="100" cy="171" rx="7.4" ry="5.4" fill="${LINE}"/><ellipse cx="98" cy="169.4" rx="2.4" ry="1.5" fill="#fff"/>`; mouthY = 181;
        bodyExtra = `<ellipse cx="78" cy="216" rx="10" ry="8" fill="${sp.inner}" opacity=".8"/>`;
        break;
      case 'sori':
        back = `<path d="M132 250 C176 256 192 214 170 190 C164 214 150 226 136 230Z" fill="${f}" ${sw()}/><path d="M170 190 C164 206 158 214 150 220 C162 222 176 214 178 202Z" fill="#fff"/>`;
        ears = `<path d="M38 132 L40 70 L88 100Z" fill="${f}" ${sw()}/><path d="M162 132 L160 70 L112 100Z" fill="${f}" ${sw()}/><path d="M48 116 L48 86 L72 102Z" fill="#5B4A57"/><path d="M152 116 L152 86 L128 102Z" fill="#5B4A57"/>`;
        over = `<path d="M30 170 C52 168 74 174 100 190 C126 174 148 168 170 170 C162 196 136 210 100 210 C64 210 38 196 30 170Z" fill="${sp.inner}"/>`;
        face = `<ellipse cx="100" cy="172" rx="5.4" ry="4" fill="${LINE}"/>`; mouthY = 182;
        bodyExtra = `<ellipse cx="100" cy="240" rx="22" ry="20" fill="${sp.inner}" stroke="none"/>`;
        break;
      case 'pang':
        ears = `<circle cx="48" cy="104" r="20" fill="${sp.inner}" ${sw()}/><circle cx="152" cy="104" r="20" fill="${sp.inner}" ${sw()}/>`;
        over = `<ellipse cx="72" cy="162" rx="17" ry="21" transform="rotate(28 72 162)" fill="${sp.inner}"/><ellipse cx="128" cy="162" rx="17" ry="21" transform="rotate(-28 128 162)" fill="${sp.inner}"/><ellipse cx="74" cy="160" rx="10" ry="12.4" fill="#fff"/><ellipse cx="126" cy="160" rx="10" ry="12.4" fill="#fff"/>
                <g transform="translate(150 98) rotate(24)"><path d="M0 4 C-14 -12 -6 -26 4 -18 C10 -26 22 -14 8 2Z" fill="#7FD18B" ${sw(3)}/></g>`;
        face = `<ellipse cx="100" cy="172" rx="6" ry="4.2" fill="${LINE}"/>`; mouthY = 182;
        bodyExtra = `<path d="M62 204 C70 214 130 214 138 204 L140 220 C120 230 80 230 60 220Z" fill="${sp.inner}"/>`;
        break;
      case 'yuni':
        back = `<path d="M136 246 C160 252 172 238 168 220 C160 232 150 230 146 224 C150 236 142 242 136 240Z" fill="#B48CFF" ${sw()}/>`;
        ears = `<path d="M46 122 C38 100 46 82 58 80 C64 94 66 108 70 116Z" fill="${f}" ${sw()}/><path d="M154 122 C162 100 154 82 142 80 C136 94 134 108 130 116Z" fill="${f}" ${sw()}/>
                <path d="M146 96 C172 100 184 130 176 160 C168 146 160 140 152 140 C164 128 158 108 146 96Z" fill="#FF9CC8" ${sw(3.6)}/><path d="M158 112 C176 124 180 148 172 170 C166 160 160 156 154 154 C164 144 166 126 158 112Z" fill="#B48CFF" ${sw(3.6)}/>`;
        over = `<path d="M92 98 L100 52 L108 98Z" fill="#FFE066" ${sw(3.6)}/><path d="M95 84 l10 -4 M97 70 l7 -3" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/>
                <path d="M62 112 C70 92 92 90 104 100 C96 104 92 112 92 120 C82 112 72 112 62 112Z" fill="#7FD9F2" ${sw(3.6)}/>`;
        face = `<ellipse cx="100" cy="170" rx="4.6" ry="3.4" fill="#FF8FB0"/>`; mouthY = 180;
        break;
    }
    const lowerMouth = k === 'bori' ? `<path d="M100 175 v4" ${sw(3)}/>` : '';
    return `<svg class="mascot-svg" viewBox="0 0 200 312" aria-hidden="true">${out.defs ? `<defs>${out.defs}</defs>` : ''}
      <ellipse cx="100" cy="286" rx="54" ry="8" fill="rgba(75,54,66,.14)"/>
      <g transform="translate(0 6)">
      ${back}${out.back || ''}
      <g class="m-body">${k === 'lumi' ? bodyRig(sp.dress, mood, gem(sp, 100, 234), '#FF8FBF', `<path d="M72 198 C66 220 46 252 44 264 C70 274 130 274 156 264 C154 252 134 220 128 198Z" fill="${sp.dress}" ${sw()}/><path d="M48 258 q13 10 26 2 q13 10 26 2 q13 10 26 2 q13 10 26 2" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`) : bodyRig(tint, mood, bodyExtra + gem(sp, 100, 238), f)}${out.neck || ''}</g>
      <g class="m-head"${mood === 'think' ? ' transform="rotate(-6 100 200)"' : ''}>${ears}${head}${over}
        ${cheeks(eyeY + 14)}${eyes(mood, eyeY)}${(k === 'lumi' || k === 'yuni' || k === 'pomi') && !/joy|cheer|wink|think/.test(mood) ? `<path d="M64 ${eyeY - 6} l-6 -4 M136 ${eyeY - 6} l6 -4" ${sw(3)}/>` : ''}${face}${mouthY < 999 ? mouth(mood, mouthY) : ''}${lowerMouth}
        ${out.eyes || ''}${out.hat || ''}</g></g></svg>`;
  };
  G.CHF = C;
})(typeof window !== 'undefined' ? window : globalThis);
