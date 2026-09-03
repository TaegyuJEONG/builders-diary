---
date: 2026-08-29
attempt: 01
title: 보조 모델이 메인 모델을 타고 있는지 확인하고 막기
---

## 1. 상황
Hermes 프로필 4개를 만들고 judge/builder 의 메인 모델을 sonnet-4.6 으로 올렸다.
설정에 `auxiliary.free_only: true` 가 있었고, 이름만 보고 "보조 트래픽은 무료/저가로 묶인다"고
이해하고 있었다. 밤새 카드가 도는 구조라, 이 이해가 틀렸으면 컨텍스트 압축이 반복될 때마다
sonnet 이 붙는다.

## 2. 판단 기준 (실행 전에 씀)
- 메인과 **다른** 모델을 보조 슬롯에 박고 보조 호출을 한 번 태운다.
- 실제로 나간 모델이 슬롯에 박은 값이면 → 오버라이드가 먹는다. 이걸로 막을 수 있다.
- 메인 모델이면 → 오버라이드가 무시된다. 다른 수단을 찾아야 한다.
- 호출 자체가 안 일어나면 → `free_only` 가 스킵한 것이다.
- **모델의 자기보고는 근거로 안 친다.** 실행 흔적(DB 또는 로그)만 근거다.

## 3. 한 것
- 소스에서 해결 순서 확인: `agent/auxiliary_client.py` 머리말
- 카나리아: 메인이 haiku 인 프로필에서 `auxiliary.profile_describer.model = claude-sonnet-4-6`
  으로 박고 `hermes profile describe auxtest --auto` 실행
- 확인 후 judge/builder 의 8개 슬롯을 haiku 로 고정

## 4. 결과
소스 머리말의 해결 순서 1번이 `User's main provider + main model` 이었다.
`free_only` 는 주석에 명시적으로 "restricts the **step-2** fallback" — 2순위 OpenRouter 만 막는다.
즉 **누수를 전혀 막지 않고 있었다.**

카나리아 실행 후 `~/.hermes/logs/agent.log`:
```
Auxiliary auto-detect: using main provider anthropic (claude-haiku-4-5-20251001)
Auxiliary profile_describer: using anthropic (claude-sonnet-4-6)
```
두 줄이 다르다 → 슬롯 오버라이드가 이긴다. `free_only: true` 상태에서도 먹는다.

judge 에 적용 후 재실행:
```
Auxiliary auto-detect: using main provider anthropic (claude-sonnet-4-6)
Auxiliary profile_describer: using anthropic (claude-haiku-4-5-20251001)
```

## 5. 틀린 것 / 다음에 바꿀 것
- **측정 지점을 처음에 잘못 골랐다.** `state.db` 의 `session_model_usage` 를 근거로 잡았는데
  `profile_describer` 는 거기 기록되지 않는다. 호출은 성공했는데 행이 없었다.
  → 보조 트래픽의 관측 지점은 DB 가 아니라 `agent.log` 다.
- 그 전에 "비용 추적은 `session_model_usage` 에 이미 있으니 만들 필요 없다"고 단정해서
  스킬 파일에 써넣었다. 반증되어 되돌렸다. **한 테이블에 컬럼이 있다고 원장인 건 아니다.**
- `auxiliary.delegation` 을 슬롯이라고 단정하고 설정에 박았다. 실제로는 최상위 키였다.
  소스에 `auxiliary.delegation` 문자열이 있는 걸 grep 으로 잡고 슬롯이라고 결론냈다.
  → 문자열 존재는 스키마의 증거가 아니다. `config_defaults.py` 에서 블록 안인지 봐야 한다.
- **순서가 틀렸다.** 공식 문서를 먼저 읽었으면 "By default, auxiliary tasks route to your main
  chat model" 한 문장으로 끝났을 것이고, 슬롯 목록도 거기 있었다. 문서 없이 측정부터 했다.
