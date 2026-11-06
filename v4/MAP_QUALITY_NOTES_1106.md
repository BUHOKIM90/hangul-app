# 지도 품질 (11/06)

이모지 장식, 출발/도착 깃발, 칸 아이콘을 `assets/map/*.svg` 자리로 바꿨다. 피자 그림이 오면 같은 이름 webp로 갈아끼우면 된다. 목록은 `assets/map/SLOTS.json`.

## 지금 보이는 것

- 길: 크림색 바닥(`pathbed`) 위에 주황 점선(`pathdash`).
- 세계 배경: 기존 `assets/pic/map_w1.webp`~`map_w6.webp`. 그 위 장식은 svg.
- 단원 이정표: `scene_XX.webp`가 있으면 그 그림, 없으면 `lm_slot.svg`. 전용 자리는 `lm_01`~`lm_34` (art.js에 넣기 전에는 쓰이지 않음).
- 다음 돌: `nextup` 테두리. 그 돌로 들어오는 화살표는 `to-next`.
- 출발/도착: `flag_start.svg`, `flag_goal.svg`.
- 하루 칸 아이콘: `step_<놀이>.svg`.

## 아직 피자 그림이 아닌 것

svg는 자리 표시다. 세계 배경과 단원 장면만 기존 피자 webp다. 돌 위 스티커 그림은 그대로다.
