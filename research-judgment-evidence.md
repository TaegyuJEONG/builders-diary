# 가설 검증 리서치 종합 — "판단의 기록이 새로운 실력 증명이다"

날짜: 2026-09-05
방법: (1) 사용자 선정 JD 749개 정량 분석 (published_jobs, Supabase)
      (2) 채용 담당자/플랫폼 딥리서치 (3) AI 오피니언 리더 딥리서치
      (4) 빌더/크리에이터 담론 딥리서치 — 서브에이전트 3개 병렬
원문: ~/.hermes/profiles/builder/cache/delegation/subagent-summary-{0,1,2}-20260905_*.txt

## 검증 대상 가설

1. AI 산출물 자체의 증명력은 폭락했다
2. "AI가 제안하고 사람이 기각/수정한 판단의 기록"이 새로운 실력 증명이다
3. 타겟은 개발자가 아니라 빌더 전반이다 (인터뷰·리서치·디자인·세일즈 포함)

## 평결: 3개 가설 모두 4개 독립 소스에서 교차 검증됨

---

## 1. JD 749개 정량 분석 (우리 데이터)

역할 분포: PM 310 / Engineer 165 / Designer 163 / Builder 타이틀 69 / 기타 42

| 요구사항 | 전체 | PM | Designer | Engineer |
|---------|------|-----|----------|----------|
| AI 도구 활용 | 83% | 84% | 80% | 89% |
| AI 산출물 판단/검증 | 28% | 20% | 27% | 26% |
| 포트폴리오/증빙 요구 | 36% | 22% | 69% | 36% |
| 프로토타입 | 72% | — | — | — |
| 자율성/오너십 | 66% | — | — | — |
| 세일즈/GTM | 60% | — | — | — |
| 유저 리서치 | 21% | — | — | — |

직접 인용:
- DocuSketch: "judgment to review AI-generated code critically"
- DataDome (디자이너): "direct, evaluate, and refine their output with strong design judgment"
- Heureka: "You've shipped things... Show us."
- Impress (PM): "you know when to stop and ask an engineer for help"

해석: AI 활용은 전 직군 전제(80%+). 판단 요구는 직군 불문 20~27%로 초기 확산 단계
— 표준 증명 포맷이 없는 지금이 선점 타이밍. PM/빌더는 포트폴리오 요구(22~37%)는
있는데 표준 형식이 부재.

## 2. 채용 측 (리크루터/플랫폼/빅테크)

- **Greenhouse 2025**: 리크루터 91% 후보자 기만 목격, 구직자 28% AI로 가짜
  워크샘플 생성 인정. CEO: 해법은 "시그널 품질 개선과 good friction"
- **Canva** (공식 블로그): "Yes, You Can Use AI in Our Interviews. In fact, we
  insist." 감점 패턴 명문화: AI 출력 무비판 수용. 가점: "pause to evaluate
  whether it fits their constraints" — **기각/수정이 실제 채점 기준**
- **Shopify** Thawar: "AI를 쓸지 스스로 판단하는 분별력(discernment)" 평가.
  단, 인터뷰 성적→실제 성과 연결은 업계 미해결 인정
- **Zapier**: 전 직군 AI fluency 요건화. Hung Lee: "Everyone claims they're
  'good with AI' on their CV. **Almost no one can prove it.**"
- **HBR×BrightHire**: 23,000건 인터뷰 분석 — AI 관련 질문은 2.2%뿐 (수요-실행 격차)
- **LinkedIn** Aneesh Raman: "AI is replacing degrees with **proof of work**"
- **ServiceNow HR**: "self-report 스크리닝 → evidence-based 스크리닝으로 이동"
- 빅테크 공통 루브릭 배점 ~40%가 error detection + verification discipline

공백: 현재 해법은 전부 채용사 측 검증(시험·프록터링·사기탐지). **후보자가
소유·휴대하는 판단 증거 포트폴리오는 공백 지대.**

## 3. AI 오피니언 리더

- **Karpathy**: "You basically still have to be in charge of the aesthetics,
  the judgment, the taste, and oversight" / "You can outsource your thinking,
  but you can't outsource your understanding" / 퍼즐 면접 폐기, 실전 프로젝트
  검증 제안
- **Simon Willison**: vibe coding과 전문가의 경계 = "reviewed, tested and
  understood" — 검토·이해·책임. 용어는 'agentic engineering'으로 이동 중
- **Garry Tan (YC)**: "I care less and less what university someone went to"
  — GitHub을 "living record", "audit trail for agency"로 명명. taste/agency/
  product sense가 학벌 대체 기준
- **Sam Altman**: "taste and agency가 경력 연차를 이긴다"
- **Ethan Mollick**: "connoisseurs of output" — 산출물 감식가가 새 실력
- **PG**: "world of thinks and think-nots" — 사고의 증거가 희소 자원

**핵심 반론 (Mollick 2026-08)**: "에이전트도 taste/judgment를 수행한다" →
대응: 판단의 '양'이 아니라 **책임(accountability)이 걸린 인간의 개입**을
기록해야 함. 재반박 인용: "an agent making a thousand plausible micro-choices
is still sampling, not weighing something it's accountable for"

## 4. 빌더/크리에이터 담론

- **levelsio**: fly.pieter.com 과정 실시간 공개 → 17일 $1M ARR, 1억+ 뷰.
  과정 공개 자체가 마케팅이자 실력 증명임을 실증
- **Marc Lou**: 월별 수익 공개 3년 → 연 $1M, 광고비 $0. 단 "매일 기록하는
  노동 + 2~3년 일관성"이 최대 진입장벽 → **자동화 기회**
- **Greg Isenberg**: "Someone should build **GitHub for normies**. Now that
  anyone can build software with AI, millions of non technical people are
  making apps, but..." — 우리 카테고리를 공개 요청한 트윗
- **YC W25**: 배치의 25%가 코드 95% AI 생성 → "proof of work → **proof of
  prompt/process**"로 증명 단위 이동
- **채용 현장** (Igor Arkhipov, LinkedIn): "I want to see their prompts. Show
  me how you talked to the AI about the problem"
- **Guillermo Rauch**: "Hire for Proof of Work and How People Package Their
  Ideas" — 공개 작업 보고 채용 DM 보낸 실사례
- **How I AI 팟캐스트**: AI 워크플로 화면공유가 콘텐츠 장르로 제도화
- **YC 경계**: "aura farming"(보여주기 브랜딩) 반발 존재 → "authentic,
  low-key evidence" 포지셔닝 필수

## 종합: 제품에 주는 지시

1. **포지셔닝 문장**: "다른 도구는 무엇을 만들었나를 보여준다. 빌더스다이어리는
   AI와 일하며 무엇을 판단했나를 보여준다" — 4개 소스 모두와 정합
2. **기록 단위**: AI 제안 → 인간의 기각/수정/선택 + 이유. Karpathy의 협업
   루프, Canva의 채점 기준, Metaview의 프로빙 질문("What did it get wrong?
   How did you verify?")이 전부 같은 이벤트 스키마를 가리킴
3. **차별화 요건**: 변조 저항성/진본성(authentic audit trail). 워크샘플
   위조(28%) 불신이 자동 기록물에 전이되지 않게 — aura farming 반발 대응도 동일
4. **타겟 확정**: "GitHub for normies" — 비개발자 빌더에게는 증빙 인프라
   자체가 없음. 디자이너(포트폴리오 문화 69%)가 얼리어답터 후보,
   PM(310/749, 요구는 있는데 형식 부재)이 최대 시장
5. **마케팅 언어**: proof of work(LinkedIn 임원 공인), evidence-based
   (ServiceNow), audit trail(Garry Tan), agentic(Willison) 차용.
   'vibe coding'은 지는 용어 — 피할 것
6. **미해결 문제 = 기회**: "평가 신호→실제 성과" 연결은 업계 누구도 못 풀었다
   (Shopify 인정). 실작업 종단 기록을 가진 쪽이 표준을 갖는다

## 리스크

1. 자동 기록물도 위조 의심 대상이 될 수 있음 → 진본성 설계가 1급 요건
2. Mollick 반론: 판단 기록이 '인간의 책임'을 증명하도록 설계해야 함
3. 일부 인용은 2차 소스 경유 (페이월/X 로그인 장벽) — 마케팅에 직접 인용 시 원문 재확인 필요
