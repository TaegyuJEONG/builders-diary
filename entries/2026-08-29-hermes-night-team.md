---
date: 2026-08-29
title: 밤에 사람 없이 도는 에이전트 팀 세팅하기
tags: [비용 감각, 검증 규율, 문서보다 실행 흔적, 무인 실행 설계, 자기 오류 교정]
duration: 이틀 (8/28~8/29)
---

## 무엇이 문제였나

낮에 설계하고 밤에 에이전트가 돌고 아침에 판단하는 구조를 만들려고 했다.
Hermes Agent 의 칸반과 프로필을 쓰면 될 것 같았다. 문제는 이게 남의 도구라는 것이다.
설정 키 하나를 잘못 이해하면 밤새 비싼 모델이 조용히 돌고, 아침에 결과물이
사라져 있고, 그걸 알아챌 방법이 없다. 사람이 안 보는 시간에 도는 시스템에서
가장 나쁜 실패는 멈추는 게 아니라 **그럴듯하게 잘못 도는 것**이다.

## 장면 1 — 첫 카드가 3초 만에 죽었다

- **앞에 있던 것**: 프로필 4개(scout/listener/judge/builder)를 만들고 칸반 카드를 하나 던졌다.
- **기준**: `기준 없이 시작함`. "일단 되는지 보자"로 던졌다.
- **한 것**: 칸반 카드 생성 → 즉시 blocked.
- **본 것**: `HTTP 402 Insufficient Balance` (DeepSeek). 3초 만에 죽었다.
  `model.provider` 를 anthropic 으로 바꾼 뒤에도 `model.base_url` 이 DeepSeek 을 가리키고 있었다.
  Anthropic 모델명을 DeepSeek 엔드포인트로 쏘고 있었던 것.
- **틀린 것**: 프로바이더만 바꾸면 되는 줄 알았다. `base_url` 을 비우고서야
  `state.db` 의 `billing_base_url` 이 `https://api.anthropic.com` 으로 바뀌었다.

## 장면 2 — 게이트웨이를 네 개 켜야 하나

- **앞에 있던 것**: 프로필 4개의 게이트웨이가 전부 `stopped`. 카드가 특정 프로필로
  가려면 그 프로필의 게이트웨이가 떠 있어야 하는지 몰랐다.
- **기준**: 던지기 전에 세 갈래를 미리 적었다. scout 전용 `state.db` 에 세션 행이 생기면 라우팅되는 것,
  default 것에만 생기면 default 가 자기가 처리한 것, 아무 데도 없으면 디스패처가 안 집는 것.
  모델의 자기보고는 근거로 치지 않기로 했다.
- **한 것**: `--assignee scout --workspace dir:~/work/research` 카드 하나.
- **본 것**: 18초 만에 done. 결과 파일의 `pwd` 가 `~/work/research`(scout 의 cwd),
  `profiles/scout/state.db` 에 새 행, default 쪽 최신 행은 33분 전 것 그대로.
  게이트웨이 하나가 디스패처를 돌리고 지정된 프로필의 워커를 띄운다.
- **틀린 것**: 없음. 다만 이건 공식 문서에 이미 적혀 있었다 (장면 4).

## 장면 3 — 막았다고 믿었는데 안 막고 있었다

- **앞에 있던 것**: judge/builder 의 메인 모델을 sonnet 으로 올렸다. 설정에
  `auxiliary.free_only: true` 가 있었고, 이름을 보고 배경 작업은 저가로 묶인다고 이해했다.
  밤새 컨텍스트 압축이 반복되는 구조라 이 이해가 틀리면 계속 샌다.
- **기준**: 메인과 다른 모델을 슬롯에 박고 보조 호출을 한 번 태운다.
  나간 모델이 박은 값이면 오버라이드가 먹는 것, 메인이면 무시된 것, 호출 자체가
  없으면 `free_only` 가 스킵한 것. 근거는 실행 흔적만.
- **한 것**: 소스 확인 후 카나리아 — 메인이 haiku 인 프로필에서
  `auxiliary.profile_describer.model = claude-sonnet-4-6` 으로 박고
  `hermes profile describe auxtest --auto`.
- **본 것**: `agent/auxiliary_client.py` 머리말의 해결 순서 1번이
  `User's main provider + main model` 이었다. `free_only` 는 주석에 명시적으로
  "restricts the **step-2** fallback" — 2순위 OpenRouter 만 막는다. **누수를 전혀 막고 있지 않았다.**
  적용 후 `agent.log` 두 줄이 갈렸다:
  `auto-detect: using main provider anthropic (claude-sonnet-4-6)` /
  `profile_describer: using anthropic (claude-haiku-4-5-20251001)`
- **틀린 것**: 세 개. (1) 측정 지점을 `state.db` 로 잡았는데 `profile_describer` 는
  거기 기록되지 않는다 — 호출은 성공했는데 행이 없었다. 관측 지점은 DB 가 아니라 로그였다.
  (2) 그 전에 "비용 추적은 이미 그 테이블에 있으니 만들 필요 없다"고 단정해 문서에 써넣었다가 되돌렸다.
  컬럼이 있다고 원장인 건 아니다. (3) `auxiliary.delegation` 을 슬롯이라고 믿고 설정에 박았다.
  소스에 그 문자열이 있길래 그렇게 결론냈는데, 실제로는 최상위 키였다. CLI 가 경고했고 그 경고가 맞았다.

## 장면 4 — 반나절이 재발명이었다

- **앞에 있던 것**: 위 세 장면을 다 끝낸 뒤에야 공식 문서를 열었다.
- **기준**: 확인한 것 하나하나가 문서에 있었는지 대조한다.
- **한 것**: `docs/user-guide/configuration` 과 `features/kanban` 을 읽고 항목별 대조.
- **본 것**: "By default, auxiliary tasks route to your main chat model" — 장면 3의 핵심이 한 문장으로 있었다.
  보조 슬롯 10개 목록도, "Only one gateway needs to run the dispatcher"(장면 2)도 있었다.
  대신 문서가 틀린 곳도 나왔다: 보조 모델 해결 순서를 3단계로 적어놨는데 소스는 7단계였고,
  `free_only` 는 문서에 아예 없었다. 그리고 문서에서만 얻은 것 하나 —
  기본 워크스페이스 `scratch` 는 **완료 시 삭제된다**. 무심코 기본값으로 밤 카드를 던졌으면
  아침에 결과물이 없었을 것이다.
- **틀린 것**: 순서. 문서를 먼저 읽었으면 장면 2와 3의 절반은 안 해도 됐다.

## 남은 것

- 프로바이더를 바꾸면 `base_url` 을 반드시 비운다. 확인은 설정이 아니라 `billing_base_url` 로.
- 문서를 먼저 읽어 범위를 좁히고, **돈이 걸리거나 되돌릴 수 없는 지점만** 측정한다.
  문서가 틀린 사례가 실제로 나왔으므로 "문서를 믿는다"도 답이 아니다.
- 문자열 grep 으로 설정 키를 단정하지 않는다. 스키마 블록 안인지 라인 번호로 확인한다.
- 측정 지점을 고를 때, 그 지점이 **기록을 남긴다는 것 자체를 먼저 확인한다.**
  0건이 "없다"인지 "안 잡힌다"인지 구분되지 않으면 그 측정은 무효다.
- 밤에 도는 카드는 `--workspace dir:<절대경로>` 를 강제한다. 기본값은 결과를 지운다.

---
태그 근거: 비용 감각 ← 장면 3 / 검증 규율 ← 장면 2, 3 / 문서보다 실행 흔적 ← 장면 3, 4 /
무인 실행 설계 ← 장면 1, 4 / 자기 오류 교정 ← 장면 3의 틀린 것 3개, 장면 4
