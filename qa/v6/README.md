# v6 QA (headless Chrome, playwright-core)

준비: `python3 -m http.server 4173` (저장소 루트), playwright-core는 `/tmp/pw/node_modules`.
결과는 `OUT` 폴더(기본 `/tmp/hangul-qa`)의 `audit/*.json`, `shots/*.png`.

- `node audit.mjs phone,ipad easy,mid,hard 1-8 final` — 8단계×3난이도×폰/아이패드 전 레슨을 아이처럼 끝까지 진행.
  문제마다 한 번은 틀리고 다시 맞힘. 모든 `<audio>.play()`를 기록해서 "자막(말풍선/aria-live) = 실제 녹음 문장"인지,
  소리 나는 글자/낱말이 화면에 있는지, 탭했는데 소리가 없는지, 콘솔 오류·404·멈춤·스크롤·가려진 버튼을 검사.
- `node nav.mjs` — 연습 모드 전 놀이, 대기 6초 안내(음성+손가락), 다시 듣기, 노래 톡톡 칸마다 소리, 스티커 책, 옷 입히기,
  어른 문(틀린 답/맞는 답), 어른 메뉴에서만 확대 허용, 소리 끄면 무음.
- `node tour.mjs <tag> <lesson> phone,ipad` — 화면 스크린샷 순회.
- `release_check.sh <repo>` — 이·우·으 mp3 원본 그대로인지, sw.js FILES 전부 존재, 아이 화면 확대 금지.
