# 몽글이 친구 옷입히기 스타일 가이드 — 제작 기준안
2026-11-07 KST. 대상 3~4세. 포근함·단순함·소장감.
실제 확인 기준: hangul_v5_quality/_refs/mongle_basic.png. 크림색 몽글 털, 갈색 얇은 윤곽, 은은한 크림 음영, 큰 갈색 반짝 눈, 작은 미소, 분홍 볼. 배경용 flat 규칙보다 실제 캐릭터 레퍼런스를 우선한다. 실사/3D/질감 과장/작가명/문자/로고 금지.
팔레트: 크림 #FFF9EB, 피치 #F9D6CC, 민트 #D7E9DD, 갈색 #6B5040, 배경 투명.
빛: 왼쪽 위 부드러운 확산광, 약한 대비. 카메라: 정면 직교, 원근 왜곡 없음.
고정: 머리 크게·짧은 몸·양팔 살짝 벌린 중립 자세·발 두 개 정면·눈 정면·장신구와 옷 없는 기본몸.
4명: 보리(살구 곰), 토리(크림 토끼 짧은 귀), 모모(민트 고양이), 구름(크림 구름 친구, 작은 팔다리).
512x512 RGBA 공통 원점 좌상단 (0,0). 목표 머리중앙(256,162), 목(256,270), 몸통(256,330), 왼발바닥(216,460), 오른발바닥(296,460). 전체 실루엣 여백 최소20px. 귀/구름 돌기는 머리중앙과 별도.
앵커는 최종 이미지를 확인해 캐릭터별 JSON 기록. 목표와 실제는 구분하며 자동 동일핏을 보장하지 않는다. 몸·목·머리 폭이 다르면 개별 전용 아이템 필요.
아이템 규격: 동일512 캔버스, 원점 그대로 합성. 캐릭터_슬롯_이름.webp, 슬롯 hat/top/acc/shoes/bg만. 이번에는 아이템 생성 안 함.
공통 프롬프트: match supplied Mongle reference, premium soft pastel 2D plush illustration, fine warm brown contour, cream shading, glossy brown eyes, pink cheeks, tiny smile. Front orthographic full-body, symmetrical neutral standing, arms slightly away from torso, two separated feet, no clothing, one character, no text/logo. Solid white background for local alpha extraction if transparency unsupported.
검증: 알파·경계 잘림 수치 확인 + grid와 overlay 육안. 생성 실패 시 재시도/우회 없이 중단.
