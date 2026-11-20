---
version: alpha
name: 려원 한글 놀이 — 별 요정 스티커북
description: >
  Hangul play app for one 4–7-year-old at home. Soft pastel picture-book look, one warm plum-brown line,
  the Hangul glyph is always the biggest and clearest thing on the screen. Palette follows Pizza's kids
  kit (/workspace/team/out/code/hangul_app/STYLE_pizza.md). Source of truth for values: the single
  :root block at the top of v6/css/app.css — change a token there and here together.
colors:
  primary: "#FF8FAB"
  primary-deep: "#E8789A"
  primary-soft: "#FFC8D6"
  secondary: "#8FD3FF"
  secondary-deep: "#74B4E2"
  secondary-soft: "#D2EAFA"
  tertiary: "#9BE3C3"
  tertiary-deep: "#5FBE9E"
  tertiary-soft: "#C4EEDF"
  reward: "#FFE27A"
  reward-deep: "#E9B648"
  reward-soft: "#FFE7A6"
  retry: "#FFB38A"
  retry-deep: "#F29E70"
  retry-soft: "#FFE0CC"
  lavender: "#C9B9F5"
  lavender-deep: "#9F8BE0"
  lavender-soft: "#E4DBFB"
  neutral: "#FFF8EE"
  surface: "#FFFFFF"
  panel: "#FFFCF8"
  on-surface: "#4B3642"
  on-surface-sub: "#745F6B"
  glyph: "#B8456E"
  focus: "#217EC4"
  error: "#A10000"
typography:
  glyph-hero:
    fontFamily: Jua
    fontSize: 132px
    lineHeight: 1
  glyph-peek:
    fontFamily: Jua
    fontSize: 156px
    lineHeight: 1
  headline-lg:
    fontFamily: Jua
    fontSize: 35px
    lineHeight: 1.2
  label-lg:
    fontFamily: Jua
    fontSize: 31px
  label-md:
    fontFamily: Jua
    fontSize: 23px
  label-sm:
    fontFamily: Jua
    fontSize: 12px
  parent-body:
    fontFamily: Jua
    fontSize: 16px
    lineHeight: 1.5
  parent-small:
    fontFamily: Jua
    fontSize: 14px
rounded:
  sm: 12px
  md: 24px
  lg: 32px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  target-min: 48px
  target-child: 64px
  target-hero: 140px
motion:
  press:
    duration: 60ms
    timingFunction: ease-out
  release:
    duration: 260ms
    timingFunction: cubic-bezier(.34, 1.8, .5, 1)
  praise:
    duration: 800ms
    timingFunction: ease-out
components:
  button-go:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    height: 78px
  button-next:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    height: 78px
  button-listen:
    backgroundColor: "{colors.reward}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    size: 64px
  button-hud-home:
    backgroundColor: "{colors.reward}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    size: 64px
  card-meet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.glyph}"
    typography: "{typography.glyph-hero}"
    rounded: "{rounded.md}"
  card-retry:
    backgroundColor: "{colors.retry}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  panel-list:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  tab-sticker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: 52px
  tab-sticker-on:
    backgroundColor: "{colors.reward}"
    textColor: "{colors.on-surface}"
  chip-world:
    backgroundColor: "{colors.secondary-soft}"
    textColor: "{colors.on-surface}"
  page-background:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
  parent-button:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    typography: "{typography.parent-body}"
    rounded: "{rounded.sm}"
    height: 48px
  parent-button-warn:
    backgroundColor: "{colors.reward-soft}"
    textColor: "{colors.on-surface}"
  parent-button-go:
    backgroundColor: "{colors.reward}"
    textColor: "{colors.on-surface}"
  parent-button-rec:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-surface}"
  parent-button-danger:
    backgroundColor: "#FFE1E1"
    textColor: "{colors.error}"
  parent-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: 48px
  parent-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-sub}"
    typography: "{typography.parent-small}"
  focus-ring:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.focus}"
---

# 려원 한글 놀이 DESIGN.md

AI 코딩 도구와 사람이 이 앱 화면을 고칠 때 먼저 읽는 파일이다. 위 YAML 토큰이 기준값이고, 실제 값은 `v6/css/app.css` 맨 위 `:root` 한 곳에만 있다(CSS 변수 이름은 아래 표). 새 색·새 모서리 값을 화면 규칙 안에 직접 쓰지 말고 토큰을 쓴다.

## Overview

- 대상: 집에서 쓰는 만 4–7세 아이 한 명 + 어른(부모) 메뉴. 게시·광고·결제·외부 링크 없음.
- 느낌: 말랑한 파스텔 그림책(「별 요정 스티커북」). 따뜻하고 차분하게, 화면에는 할 일 하나만 둔다.
- 1순위는 **한글 글자**다. 글자는 화면에서 가장 크고, 가장 진하고, 움직이지 않는다.
- 선 규칙: 누를 수 있는 것은 진한 자두갈색 선(`--line`)과 아래 「계단」 그림자(`--step`)를 가진다. 보기만 하는 것(판·이름표)은 선이 없다.
- 시각 기준: 피자 `STYLE_pizza.md`(5색 + 크림, 코코아 글자, 틀림은 살구, 번쩍임 금지). 구조만 `/workspace/team/ref/design/README.md`(YAML + 섹션, 4px 격자)에서 빌렸다. `DESIGN_buho.md`(어른용 내부 도구)는 쓰지 않는다.

## Colors

| 역할 | 토큰 | CSS 변수 | 값 | 쓰는 곳 |
|---|---|---|---|---|
| 바탕 | neutral | `--cream` | #FFF8EE | 페이지 바탕, 어른 버튼 |
| 글자·선 | on-surface | `--ink` | #4B3642 | 모든 글자, 누르는 것의 선과 계단 |
| 보조 글자 | on-surface-sub | `--sub` | #745F6B | 어른 메뉴 설명, 작은 안내 |
| 한글 큰 글자 | glyph | `--glyph` | #B8456E | 만나요 카드 글자, 숨은 글자(`.peek`, `.hide-t`), 옷장 별값·잠금 글씨(`.citem small`), 새 스티커 배지 바탕(흰 글자 5.1:1), 시작 화면 「한글 놀이」 |
| 딸기(주) | primary | `--st2` (`--st1`/`--st3`) | #FF8FAB | 다음·칭찬 |
| 하늘(보조) | secondary | `--sk2` | #8FD3FF | 듣기, 마을 이름표 |
| 민트 | tertiary | `--mi2` | #9BE3C3 | 놀자!·출발 같은 「앞으로」 |
| 레몬 | reward | `--bu2` | #FFE27A | 별·보상, 선택된 탭 |
| 살구 | retry | `--pe2` | #FFB38A | 틀렸을 때 「다시 해 볼까?」 (빨강 금지) |
| 라벤더 | lavender | `--la2` | #C9B9F5 | 쉬는 상태(`.play-go.rest`) |
| 판 | panel | `--panel` | #FFFCF8 | 짧은 가로 목록 판 |
| 포커스 | focus | `--b3` | #217EC4 | `:focus-visible` 4px 테두리 (흰 바탕 4.3:1, 비텍스트 기준 3:1 통과) |

- 각 색은 `1`(옅음, 바탕) · `2`(기본, 채움) · `3`(진함, 테두리) 세 단계다. 글자는 늘 `--ink` 위에 쓴다. 흰 글자를 파스텔 위에 쓰지 않는다.
- 대비(측정): `--ink`는 크림 위 10.4:1, 딸기 #FF8FAB 위 5.2:1 이상, 모든 `2` 채움 위 4.5:1 이상. `--sub`는 크림 위 5.5:1(옛 #8E7884는 3.8:1로 AA 미달이라 바꿈). `--glyph`는 크림 위 4.84:1·흰 카드 위 5.1:1(옛 #E8789A는 2.6:1로 큰 글자 AA 3:1에도 미달).
- 피자 기준과 다른 점 1개: 글자색은 코코아 #5A3E36 대신 지금 앱의 자두갈색 #4B3642를 유지한다. 코코아는 딸기 #FF8FAB 위에서 4.49:1로 AA 4.5에 조금 못 미치고, 캐릭터 SVG 선(JS 58곳)이 #4B3642라 같이 바꿔야 한다. 피자 확인 필요.
- 세계(마을)마다 하늘·언덕 색 4개(`--sky1`, `--sky2`, `--hill1`, `--hill2`)는 `app.js`가 `:root`에 덮어쓴다. 그 밖의 토큰은 JS가 바꾸지 않는다.
- 옛 「3D 장난감 상자」 층의 색(`--go*`, `--y*`, `--p*`, `--b*`, `--v*`, `--o*`, `--hot`, `--green` …)은 아직 일부 규칙이 쓴다. 새 규칙에는 쓰지 않는다.

## Typography

- 글꼴: **Jua**(OFL, `fonts/Jua-Regular.woff2`, 앱에 포함, 오프라인 동작). 대체: Apple SD Gothic Neo → Noto Sans KR. 그림 글자는 `--emoji`.
- 크기는 화면 짧은 변(vmin)에 맞춰 커진다. YAML의 px는 390×844 폰 기준 값이다.
  - 만나요 카드 한글: `34vmin`(세로 폰 `30vmin`) → 약 117–132px. 숨은 글자 `40vmin`.
  - 큰 버튼 글자: `8vmin`(약 31px). 피자 기준 32px에 거의 맞는다.
  - 탭·이름표: 최소 12px(`max(12px, 2.8vmin)`).
  - 어른 메뉴는 px 고정: 본문 16px, 설명 14px.
- 한글 글자 규칙: 줄바꿈은 `word-break: keep-all`. 글자 위에 다른 것을 겹치지 않는다. 글자에는 반짝·흔들림 애니메이션을 걸지 않는다.

## Layout

- 4px 격자: 어른 메뉴의 px 간격은 4의 배수(4·8·12·16·24). 아이 화면은 vmin 비율이며, 바꿀 때 아래 측정 크기에서 잘림 0을 지킨다.
- 측정 크기(Lily 기준): 360×780, 390×844, 780×360(S24 가로), 834×1194, 1194×834. 가로 스크롤 0, 버튼 화면 밖 0.
- 안전 영역: `--sat` `--sab` `--sal` `--sar`(env safe-area). `#app`과 짧은 가로 `.pg` 아래 여백이 사용한다.
- 짧은 가로(`max-height: 540px`): 스티커북·옷장·놀이터 목록은 불투명 판(`--panel`, `--r`, `--soft`) 안에서 끝난다(8f36716).

## Elevation & Depth

- 누르는 것: `--step`(아래 0.9vmin 진한 선) + `--line`. 누르면 계단 위로 내려앉는다(`translateY(.8vmin)`).
- 판·카드: `--soft` 그림자 하나만(0 1.2vmin 2.6vmin, 잉크 12%). 광택(`--hi`)은 끈 상태.
- 장식(하늘·언덕·꽃, `#scene`)은 z-index 0, 늘 내용 뒤.

## Shapes

- `--r` = `max(24px, 3.2vmin)`: 지도·홈 타일·스티커 판·목록 판. 피자 기준 「24px 이상」.
- 버튼은 알약(`full`) 또는 원. 어른 메뉴 버튼·탭은 12px.
- 각진 모서리 금지.

## Motion & Micro-interaction

- 누름 60ms, 놓음 260ms 통통 튐(`cubic-bezier(.34, 1.8, .5, 1)`).
- 칭찬은 짧게(약 0.8초) + 캐릭터 + 소리. 번쩍임·빠른 깜빡임 금지(광과민).
- `prefers-reduced-motion: reduce`: 파일 끝 **한 블록**에서 장식 움직임(구름·별·물방울·캐릭터 숨쉬기·눈 깜빡임·떠다니기·버튼 맥박)을 끄고 누름 전환을 없앤다. 「여기를 눌러」 힌트(`.hint`, `.next`)와 게임 속 물고기처럼 놀이에 필요한 움직임은 남긴다. 새 장식 애니메이션을 만들면 이 블록에 선택자를 더한다.

## Voice & Content Strategy

- 4세는 아직 못 읽는다. 모든 안내는 그림 + 음성. 글은 보조.
- 틀렸을 때: 살구색과 「다시 해 볼까?」. 빨강·X·벌점 없음.
- 아이 화면에 숫자 경쟁(연속 일수 등)을 보이지 않는다. 기록은 어른 메뉴에만.

## Components

| 컴포넌트 | 클래스 | 규칙 |
|---|---|---|
| 앞으로 버튼 | `.play-go`, `.next-btn`, `.mbtn` | 민트/딸기 채움, 잉크 글자, 선 + 계단, 높이 ≥ `--tap` |
| 홈·듣기 원 버튼 | `.hud-home`, `.speaker` | 레몬, 원, ≥ 64px |
| 만나요 카드 | `.meet-card .meet-letter` | 흰 카드, `--glyph` 글자, 가장 큰 글씨 |
| 스티커북 | `.book-tab`, `.book-page .slot` | 탭 ≥ 52px(짧은 가로), 선택 탭 레몬 |
| 옷장 | `.ctab`, `.citem` | 탭 ≥ 48px |
| 놀이터 | `.pg-item` | 왼쪽 마을 색 띠, 흰 카드 |
| 지도 | `.map`, `.stone` | `--r` 판, 지금 칸만 떠다님 |
| 어른 메뉴 | `.pm-btn`, `.pm-tab`, `.pm-close`, `.pm-row select/input` | 크림 바탕 + 라벤더 2px 선, 12px 모서리, 높이 ≥ `--tap-min`(48px) |
| 포커스 | `:focus-visible` | 4px `--b3` 테두리, 3px 띄움 |

## Do's and Don'ts

- Do: 새 색·모서리·그림자는 `:root` 토큰으로 만들고 이 파일 표에 한 줄 더한다.
- Do: 누를 수 있는 것은 48px 이상(WCAG 2.5.8 AA는 24px, 우리 기준 48px; 아이 주 버튼 64px 이상).
- Do: 글자는 `--ink`, 보조 글자는 `--sub`, 한글 큰 글자는 `--glyph`.
- Do: 고친 뒤 위 측정 크기 5개에서 잘림 0, 첫 탭 소리를 확인한다(`qa/design_shots.mjs`, `check.mjs --strict-first-tap`).
- Don't: 파스텔 위 흰 글자(풍선 글자도 `--ink`), 빨강으로 틀림 표시, 번쩍임, 글자에 `opacity`로 흐리게(대비가 깨짐 — 흐린 글자는 `--sub`).
- Don't: 화면 규칙 안에 #hex를 새로 쓰기(옛 규칙에 남은 값은 정리 대상).
- Don't: 저작권 캐릭터를 닮은 그림, 려원이 사진·실명 음성 외 개인정보.
- Don't: `DESIGN_buho.md`·노바 키트 색을 섞어 쓰기.
