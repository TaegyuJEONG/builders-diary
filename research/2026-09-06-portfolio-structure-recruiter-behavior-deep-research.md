# 딥리서치: 빌더 포트폴리오의 실제 '구성'과 채용자의 실제 '평가 행동' (2026-09-06)

> 목적: Builder's Diary 상세 페이지 템플릿(현재: Context → The judgment call → What was done → Proof → What this shows)의 재설계 근거 수집.
> 이전 리서치(2026-09-05, JD 749개 분석)의 후속. 이번엔 (a) 잘하는 빌더의 실제 포트폴리오 구조, (b) 리크루터/하이어링 매니저의 실제 평가 행동에 집중.

---

## 1. 실존 사례 — 채용 성과로 이어진 포트폴리오/빌드로그 구조

### 1-1. HN "Who wants to be hired" (2026년 6월) — AI 네이티브 채용의 실제 거래 조건
- 고용주 측(AES): **"No leetcode. No whiteboard. Show us your best AI-built work, a PR, a deployed app, or a repo."** 요구 아티팩트는 "AI 도구로 빌드한 트랙레코드, 이상적으로는 CLAUDE.md가 있는 리포 + 낯선 사람이 실제로 쓸 수 있는 곳에 배포된 end-to-end 프로젝트 1개 이상".
- 같은 스레드의 다른 고용주: **"We lean hard on AI tooling and expect you to, but the bar is human-reviewed, well-tested code; 'the model said it worked' isn't a defence."**
- 통과한 후보들의 프로젝트 공통점: 튜토리얼 클론이 아니라 **실제 auth, 결제, 영속성, 대시보드, 빌링 로직, 배포된 프로덕션급 아키텍처**. 후보 검증은 Show HN 히스토리 + GitHub + HN 코멘트 트레일로 **약 90초** 안에 이뤄짐.
- 2026 채용 스크린의 공식: **"공개된 AI-빌드 아티팩트를 보여줘라 → 그 다음 인간이 소유했음을 증명하는 테스트와 리뷰 트레일을 보여줘라."**
- 출처: https://www.refolk.ai/blog/hacker-news-who-wants-to-be-hired-june-2026 (원 스레드: https://news.ycombinator.com/item?id=48357724, 48357725)
- 실제 후보 포스트 예(2026년 9월 스레드): 프로젝트를 "실패 모드(파이프라인이 빈 파일을 쓰는 대신 런을 실패시키는 커버리지 가드)"와 정량 결과(99.7% device ID over 7,497 windows)로 서술 — 결과+검증 방식이 한 문단에 압축됨. https://news.ycombinator.com/item?id=49522896

### 1-2. Build-in-public / Learn-in-public 계열
- swyx "Learn In Public": 핵심은 **"learning exhaust"를 습관적으로 만드는 것** — "Document what you did and the problems you solved." 채용 효과는 콘텐츠 도달이 아니라 축적된 공개 기록이 신뢰·멘토·인바운드를 만드는 구조. https://www.swyx.io/learn-in-public
- Fueler(프루프오브워크 포트폴리오 플랫폼): build-in-public 여정을 **케이스 스터디로 재패키징**하는 걸 명시적 단계로 둠 — "Collect screenshots and testimonials → Summarize key lessons and results in case studies → Use your journey as proof in job applications." 즉 로그 자체가 아니라 **로그를 증거로 압축한 2차 산출물**이 채용에 쓰임. https://fueler.io/blog/beginners-guide-to-building-in-public
- 방증(반대편): 2026년 HN 사이드프로젝트 스레드 분석 — "사이드 프로젝트의 크리덴셜 기능은 자동화로 무력화됐다. GitHub 그래프, AI-assisted 데모는 오후 한나절에 생성 가능." → **'만들었다'는 사실 자체는 더 이상 시그널이 아님.** https://wimes.org/articles/2026-08-10-nobody-cares-what-youre-working-on

### 1-3. GitHub 프로필 — 실제로 보는 것
- 리크루터의 60–80%가 링크된 GitHub을 최소한 훑어봄; 전문 포지션의 40–50%는 딥다이브. 비기술 리크루터는 **수 초~수 분**(존재·최근 활동 확인 수준). https://fonzi.ai/blog/do-recruiters-check-github
- 첫 스캔 항목: 프로필 완성도(사진/바이오) → **핀된 리포** → 기여 그래프 → **README 품질**("README 없는 리포는 스킵됨"). README는 "미니 케이스 스터디": 무엇을/왜/어떻게 실행 + **설계 결정과 트레이드오프 섹션이 골드**. https://gitshare.me/blog/how-recruiters-actually-evaluate-your-github-profile-and-what-to-fix-today
- 커밋 히스토리 = 작업 방식의 증거: 의미 있는 커밋 메시지, 리뷰 가능한 단위, 수 주에 걸친 꾸준함("한 방 커밋 + 무활동 = code dump 시그널"). https://blog.cytsoftware.com/how-recruiters-actually-evaluate-your-github-profile/
- 감점: 포크를 자기 작업처럼 핀, 튜토리얼 카피, **"균일한 스타일 + 테스트 부재로 감지되는, 이해 없는 AI 생성 코드 대량 사용"**. https://fonzi.ai/blog/do-recruiters-check-github
- "하이어링 매니저의 71%가 기술 인터뷰 전에 GitHub을 본다"(2026). https://smartresumeanalyzer.com/blog/github-portfolio-resume-recruiters-2026

### 1-4. PM 포트폴리오 (2026)
- 구조 표준: **케이스 스터디 최상단에 Problem Statement / My Role / Key Outcomes** 를 배치(프론트로딩). **토글·컬럼으로 상세를 접어두고, 30초 안에 임팩트 파악 → 원하면 확장** 하는 프로그레시브 디스클로저가 명시적 베스트 프랙티스. https://underdog.io/blog/product-manager-portfolio-examples
- 케이스 수: 2–4개면 충분, "Two excellent case studies are better than six shallow ones." 노출해야 할 체인: **problem → evidence → alternatives → decision → metrics → learning**. 경험 없으면 가짜 성과 금지, 관찰된 증거와 가설을 분리 표기. https://craftuplearn.com/blog/product-manager-portfolio-projects-get-hired
- 포맷: 웹사이트가 기본 기대치이나 Notion/PDF도 통함 — "포맷이 아니라 명료성이 결정. 잘 구조화된 Notion 문서가 과적재된 Webflow 사이트를 이긴다." (RBC 팀리드 출신, 2024–25 구직으로 2개 오퍼 받은 하이어링 매니저의 1차 기록) https://medium.com/@siropinas/how-to-create-a-strong-product-design-portfolio-in-2025-and-get-hired-part-1-16889999c255

---

## 2. 리크루터/하이어링 매니저의 실제 평가 행동 (정량 데이터)

### 2-1. 시간 예산
| 데이터 | 수치 | 출처 |
|---|---|---|
| 하이어링 매니저 16명 × 지원서 243건 × 평가 1,700회 실측 | **이력서+포트폴리오 보고 인터뷰 여부 결정까지 평균 55초** | https://rockbee.com/scientific-hiring , https://presentum.io/design/hiring-explained/evaluating-portfolio-and-resume |
| 같은 연구 | 60% 이상이 'irrelevant' 판정; 만장일치 yes는 3% | 같은 출처 |
| ADPList 설문 | 포트폴리오 리뷰에 5분: 35%, 5–10분: 54%, 10분+: 11%. **"이상적 포트폴리오 = 5분 안에 리뷰 가능"**, 20분짜리 케이스 스터디는 감점 | https://blog.adplist.org/post/what-is-a-hiring-manager-looking-for-in-a-design-portfolio |
| UX 스크리닝 실무 관찰 | 1인당 약 30초 스캔; 케이스 스터디 오프닝이 10초 안에 명확하면 잔류 | https://www.superhive.co/ux-design-portfolio-review-what-hiring-managers-look-for |
| 리크루터(당사자) 기록 | 홈 10초 → 케이스 스터디당 2–3분 | https://emilybackes.design/post/what-i-actually-look-at-in-a-portfolio-review |
| UXfolio 채용 실측 | 수백 명 지원 → **약 80%를 포트폴리오만으로 탈락** | https://uxcel.com/blog/case-study-gap-what-recruiters-need |

### 2-2. 스캔 경로 (무엇을 먼저 보나)
Superhive의 30초 스캔 5단계: **① Role read**(첫 화면에서 무슨 역할/레벨인지) → **② Relevance filter**(우리 롤과 맞나) → **③ Ownership scan**(팀 벽지가 아니라 본인 기여) → **④ Proof skim**(아웃컴·사고가 above the fold에 보이나) → **⑤ Stay-or-leave**. https://www.superhive.co/ux-design-portfolio-review-what-hiring-managers-look-for

Open Doors(2026): 리뷰어가 빠르게 답하려는 5개 질문 — "이 사람이 어떤 사람인지 이해되나 / 작업이 롤과 맞나 / 품질이 충분한가 / **사고를 신뢰할 수 있나** / 인터뷰를 정당화할 증거가 있나". **리크루터는 fit을 스캔하고, 하이어링 매니저는 judgment를 스캔한다.** 프로젝트 카드 단계에서 대부분 이탈: "Mobile App Redesign" 같은 제목은 문제·맥락·중요성을 전달 못 함. About 페이지는 이미 관심 생긴 뒤에 클릭. **숨은 리뷰 = 일관성**: CV·LinkedIn·포트폴리오·GitHub을 교차 대조하고, 해석 비용이 크면 더 쉬운 후보를 택함. https://blog.opendoorscareers.com/p/how-hiring-managers-actually-scan-your-portfolio-in-2026

### 2-3. 신뢰를 주는 것 vs 감점 (1차 소스)
**신뢰(+):**
- 55초 연구에서 'yes'를 받은 지원서의 공통점: **포트폴리오 링크 / 런칭된 프로젝트의 사실과 결과 / 최근 2년 경험 / 프로덕트 팀 경험의 명시**. https://rockbee.com/scientific-hiring
- "케이스 스터디가 숫자를 명시하고(name its number), 트레이드오프를 소유하고(own its trade-off), 마찰을 숨기지 않을 때" — **"마찰이 전혀 안 보이는 포트폴리오는 유능해 보이는 게 아니라 '편집된' 것으로 읽힌다."** https://emilybackes.design/post/what-i-actually-look-at-in-a-portfolio-review
- 정보를 담은 카드 제목+임팩트 부제: "Designing an AI-powered setup experience for Cleo — reducing setup time by 40%". 아웃컴은 상단에(대부분 끝까지 스크롤 안 함). 실패한 탐색 경로 포함한 터닝포인트 서술. 배운 점·다르게 할 점 = 시니어 시그널. 섹션당 약 70% 비주얼/30% 텍스트. https://uxcel.com/blog/case-study-gap-what-recruiters-need

**감점(−):**
- **모호한 소유권**: "We redesigned…", "Our team ran…" → "리뷰어는 찾을 수 없는 결정에 크레딧을 줄 수 없다. 확인 안 되면 최소치로 가정한다." 올바른 형태: "I did X, as part of a team that also did Y and Z."
- **아웃컴 없는 프로세스 일기**: "무엇이 바뀌었는지 말 못 하면 몇 라운드 테스트를 했는지는 관심 없다." (둘 다 https://emilybackes.design/post/what-i-actually-look-at-in-a-portfolio-review )
- 제네릭 프로세스 템플릿(더블다이아몬드 투어), 학교 리포트화된 케이스, 링크 깨짐·모바일 미대응·비밀번호 마찰. https://blog.opendoorscareers.com/p/how-hiring-managers-actually-scan-your-portfolio-in-2026 , https://rockbee.com/scientific-hiring (모바일에서 열리는 포트폴리오 중요 — 매니저 4명이 모바일로 리뷰)
- AI 티 나는 장식(3D blob, 끝없는 그라데이션): "표면 광택은 점점 더 잘 간파된다." https://blog.opendoorscareers.com/p/how-hiring-managers-actually-scan-your-portfolio-in-2026

---

## 3. 케이스 스터디 서사 구조 — 전통 vs 2025–2026 AI 시대의 변화

### 3-1. 전통 구조는 유지되되 '보고서'에서 '논증'으로
- 전통: 문제 → 과정 → 결과 (problem–process–outcome). 여전히 뼈대는 유효 (underdog, uxpilot 등 2026 가이드 공통).
- 변화: **"케이스 스터디는 프로세스 문서가 아니라 '내가 이 일을 맡을 자격이 있다'는 구조화된 논증이다. 하나의 프로젝트, 하나의 실제 갈등, 하나의 명확한 아웃컴."** 템플릿 준수형 케이스는 "AI로 가장 생성하기 쉽고 가장 스킵하기 쉬운 것" → **voice(고유 관점)가 남은 유일한 차별화**. https://emilybackes.design/post/ux-case-studies-broken

### 3-2. AI 시대에 추가된 요구: 프로세스 투명성 + 검증 가능성
- AACSB(2026-04): **GenAI가 발표·포트폴리오 같은 전통 시그널을 약화시켜 'verification gap' 발생.** 고용주가 원하는 추가 증거: "데이터가 불완전할 때의 문제 프레이밍, 이해관계자가 갈릴 때의 트레이드오프 선택, AI가 그럴듯한 텍스트를 낼 때의 검증, 쉬운 길이 '생각의 외주'일 때의 책임." https://aacsb.edu/insights/articles/2026/04/bridging-the-ai-employability-gap
- 2026 AI-네이티브 인터뷰 표준 질문: **"Where did you trust the model, and where did you verify it?"** 약한 답 = 툴 목록. 강한 답 = **태스크 분할, 제약, 리뷰 스텝, 최종 수정**의 서술. 답변 시퀀스: problem → constraints → AI role → human checks → output → lesson. https://provn.co/blog/2026/06/ai-native-interview-questions
- 디자인 채용 실무(2026): 반복 등장하는 5개 신호 — "① Process transparency ② An 'AI got it wrong' case study ③ Depth over shallow finals ④ 비즈니스 언어로 된 efficiency metrics ⑤ taste를 제약으로 번역하는 커뮤니케이션". 케이스 구조 템플릿: **Brief → Constraints/bans → 탐색 그리드 → 선택 근거 → Correction log(무엇을 로컬 수정 vs 재생성) → Final → Metric/learning**. 'Clara 패턴': AI 프로세스를 숨긴 채 14회 탈락 → 실패 생성물+진단+90초 Loom을 공개하자 인터뷰 질문이 "AI 쓰세요?"에서 **"당신의 veto를 설명해 보세요"**로 바뀜. **"완벽한 갤러리보다 '처리된 실패'가 있는 포트폴리오가 성과가 좋다"**. 가짜 매출 금지 — 프록시 지표(time-to-first-acceptable-comp, 수정 라운드 수) 허용. https://www.lovart.ai/blog/ai-design-portfolio-interview-2026
- AI 사용 공개 방법론: **3-part disclosure** — "① AI가 도운 작업 ② 내가 소유한 결정 ③ 검증 방법 + 증거 포인터(커밋, 테스트, 프롬프트 로그, before/after)". "built with AI"보다 "I used AI for scaffolding; I designed the workflow, reviewed the code, tested edge cases"가 강함. 기준은 **materiality**(AI가 결과물을 실질적으로 형성했는가). https://www.learnist.org/how-to-disclose-ai-tools-in-portfolio/
- vibe coding 이력서 가이드(2026): "AI-assisted 주장은 반드시 GitHub 링크·배포 결과·프로덕션 지표와 페어링. **도구는 맥락이고 헤드라인이 아니다. 'Shipped to production'이 툴 이름보다 무겁다.**" 후속 검증 질문: 아키텍처 설명, 가장 어려웠던 버그, 무엇을 바꾸겠나. https://matchresume.ai/career-hub/topic/what-to-include/vibe-coding-resume
- vibe-coded 프로젝트 공개 여부: **"숨기는 게 더 나빠 보인다. 'I architected the approach, guided the implementation, and validated all outputs'로 프레임하라."** 감점: 배포 안 된 프로젝트, 설명 못 하는 코드, 이터레이션 흔적 없음(모든 게 초안처럼 보임). https://authenticjobs.com/how-to-become-a-vibe-coder-a-career-transition-guide-for-2026/
- 실패 사례(1차): 학생 3명이 기술 면접 탈락 — "이 인증 로직 설명해 보세요" → "음… AI가 생성했어요. JWT 쓰는 것 같은데요?" **"설명 못 하는 코드를 '만들었다'고 하면 리크루터는 안다. 그리고 즉석에서 탈락시킨다."** https://www.linkedin.com/posts/kushalvijay_story-placements-projects-activity-7380587212582793216-UTlL

---

## 4. 'judgment 강조'는 실제로 차별화 요소인가 — 균형 잡힌 증거

### 4-1. judgment/taste가 핵심이라는 진영
- Paul Graham: "When anyone can make anything, the big differentiator is what you choose to make." Greg Brockman: "Taste is a new core skill." Altman: 리서치 리크루팅도 "context, taste, and a real feel". Cloudflare CTO Knecht: **"Building is easy now. Knowing what to build ... and what not to, is the hard part."** https://fortune.com/2026/02/27/openai-sam-altman-taste-get-jobseekers-hired-ai-jobpocalypse/ , https://www.businessinsider.com/taste-new-core-skill-ai-debate-memes-2026-2
- 채용 바 관점: "Output becomes easier to produce; judgment becomes harder to evaluate." 새 시그널 = 문제 프레이밍, AI-aware 디버깅, 품질 시스템, 프로덕트 judgment. 구체 마커: **"AI가 속도를 냈지만 리스크를 만든 순간과, 그걸 어떻게 잡았는지 말해보라."** https://viralbrain.ai/blog/adriano-herdman-hiring-bar-era
- 인도 채용 시장 보도(2026): "AI 사용이 문제가 아니라 원본 사고의 부재가 문제. **왜/어떻게 AI를 썼는지 설명할 수 있는지가 진짜 시그널**, 폴리시된 출력이 아니라." (Instahyre, CoRover 창업자 인용) https://indiatoday.in/jobs/story/are-you-replaceable-in-ai-age-best-hires-are-those-who-prove-they-arent-needed-educ-2889601-2026-03-31

### 4-2. 반론과 한계
- **Mollick(2026-08-05):** "AI가 judgment·creativity·taste를 못 한다는 주장은 에이전트 시대에 명백히 틀렸다. 긴 태스크는 모두 다량의 taste, judgment, creativity를 요구한다." (질·다양성 논쟁에는 공감) https://www.linkedin.com/posts/emollick_i-find-arguments-that-ai-cant-do-judgement-activity-7490801011540791297-FMuw ; 팟캐스트에서도 "durable skills조차 이전과 달리 외주 가능해졌다" https://www.businessinsider.com/ethan-mollick-ai-expert-wharton-taste-skills-ai-2026-5
- Nan Yu(Linear Head of Product): **"You probably don't have better taste than AI."** Matt Schumer: GPT-5.3 Codex가 "처음으로 judgment, taste처럼 느껴지는 것"을 보임. https://www.businessinsider.com/taste-new-core-skill-ai-debate-memes-2026-2 , https://fortune.com/2026/02/27/openai-sam-altman-taste-get-jobseekers-hired-ai-jobpocalypse/
- 실무 채용에서 기업이 실제로 사는 것: **"돈을 벌어주거나 아껴주는 것" + 프로덕션 신뢰성.** "hot money는 프로덕션급 마이크로서비스를 출하하고 CI/CD와 CVE 스캔을 붙이고 코드리뷰에서 설명할 수 있는 사람에게 간다. AI-native 취미 개발자의 연봉은 오르지 않는다." https://becloudready.com/blog/vibe-coding-wont-get-you-hired
- 이력서/포트폴리오 차원에선 **"The output matters more than the process/method"** — 아웃컴 없는 judgment 서사는 팔리지 않음. https://matchresume.ai/career-hub/topic/what-to-include/vibe-coding-resume
- Codecademy LinkedIn 폴: 73%가 "인터뷰에서 vibe coding은 표준이 아니다" — 생성 능력이 아니라 **추론 능력**으로 평가. https://dataforest.ai/blog/is-vibe-coding-bad

### 4-3. 종합 판정
1. **judgment는 '차별화 요소'로 유효하지만, 주장(claim)이 아니라 증거(evidence) 형태일 때만 통한다.** 모든 1차 소스에서 judgment는 인터뷰 후반("walk me through your veto")과 케이스의 터닝포인트에서 검증되는 것이지, 포트폴리오의 헤드라인이 아니다.
2. **스캔 단계(55초/30초)의 우선순위는 명확히 judgment가 아니다**: ① 역할·적합성 ② 아웃컴/증거 ③ 소유권. judgment 서사는 케이스 스터디를 '열어본 뒤'(2–3분 구간)에 소비된다.
3. **AI가 judgment도 잠식 중이라는 반론(Mollick, Nan Yu)이 실재**하므로, "AI 제안을 기각했다"는 사실 자체는 시간이 갈수록 방어력이 약해진다. 반면 **검증 가능한 아웃컴 + 검증 트레일(테스트, 리뷰, 배포)**은 어느 진영에서도 부정되지 않는 불변 시그널.
4. 결론적으로 서사의 척추는 **outcome-first, judgment-as-turning-point**: judgment는 죽이지 말고 강등하라.

---

## 5. Builder's Diary 상세 페이지 템플릿에 주는 시사점

현 템플릿: `Context → The judgment call → What was done → Proof → What this shows`
뷰어: 이력서에서 흥미를 느끼고 들어온 리크루터 (= 이미 1차 스캔을 통과시켜 준 상태이지만, 여전히 55초–5분 예산으로 "인터뷰를 정당화할 증거"를 찾는 중)

### (1) 유지할 것
- **judgment call 섹션 자체는 유지.** 2026 인터뷰의 표준 질문("Where did you trust the model, where did you verify it?", "Walk me through your veto")과 정확히 맵핑되는 자산이고, Lovart의 'Clara 패턴'이 보여주듯 이걸 공개하는 것 자체가 인터뷰의 질을 바꾼다. 다만 위치와 명칭은 변경(아래).
- **Proof 섹션 유지·강화.** "verification gap" 시대의 결정적 요구. 검증 가능한 아티팩트(배포 링크, 커밋, PR, 테스트)는 taste 논쟁의 어느 진영에서도 부정되지 않는 유일한 불변 시그널.
- **세션에서 자동 추출된 로컬 기록이라는 제품 본질.** '사후에 예쁘게 쓴 케이스'가 아니라 '작업 당시의 로그에서 나온 카드'라는 점이 aura-farming 역풍에 대한 구조적 반박. 카드에 세션 타임스탬프/추출 출처 표시를 명시적으로 유지하라.
- **카드(목록) → 상세의 2단 구조.** 리크루터의 실제 행동(카드에서 클릭 여부 결정)과 일치.

### (2) 바꿀 것
- **순서를 outcome-first로 뒤집어라.** 새 척추 제안:
  `Outcome 헤더(제목+한 줄 임팩트+메타) → Context(2–3문장) → What was done(결정 중심 요약) → Key decisions & trade-offs(구 judgment call) → Proof → Learned/Next`
  근거: 55초 결정(rockbee), "아웃컴은 상단에 — 대부분 끝까지 스크롤 안 함"(Uxcel), "오프닝 라인에 outcome을 먼저 쓴다. 10초 스캔에서 살아남는 건 그것"(Emily Backes).
- **"The judgment call" → "Key decisions & trade-offs"로 개명·확장.** 이유 3가지: ① 'AI 제안 기각'만으로 좁히면 모든 카드에 억지 서사가 강제됨(모든 세션에 극적인 기각 순간이 있는 건 아님 — 없는데 만들면 '편집된' 냄새). ② 대안 비교, 제약 선택, 스코프 컷 같은 넓은 결정도 같은 시그널을 줌(craftuplearn의 problem→evidence→alternatives→decision 체인). ③ AI 기각 순간이 실제로 있으면 이 섹션 안에서 하이라이트로 표시(뱃지/아이콘) — 죽이는 게 아니라 강등+정예화.
- **"What this shows"를 제거하거나 "What I learned / What I'd do differently"로 교체.** 자기 평가형 결론("이건 내가 X 역량이 있음을 보여준다")은 주장이지 증거가 아니며, 리크루터는 주장을 최소치로 할인한다(Emily Backes의 'safe read' 원칙). 반면 배운 점·다르게 할 점은 "주니어와 시니어를 가르는 자기 인식 시그널"(Uxcel)로 실증됨.
- **Context를 압축하라.** "회사·제품 설명 3문단으로 시작하는 게 디자이너들이 가장 자주 뒤집어 쓰는 실수"(Uxcel). 문제·제약·역할이 2–3문장 안에 들어가야 함.
- **카드 제목 규칙 변경**: "informative title + outcome 부제" 강제. 나쁨: "CRM 파이프라인 개선". 좋음: "영업 리드 정제 파이프라인 자동화 — 주간 4시간 → 20분" (Uxcel의 Cleo 예시 패턴). 스킬(@builders-diary)이 세션에서 카드 추출 시 이 형식으로 제목을 생성하도록.

### (3) 추가할 것
- **① 30초 스캔 블록 (상세 페이지 최상단).** 역할/기간/사용 도구/핵심 아웃컴 지표를 한 화면에. 상세 내용은 접기(토글) — PM 포트폴리오의 검증된 프로그레시브 디스클로저 패턴(underdog). "5분 안에 전체 리뷰 가능"(ADPList)을 페이지 단위 설계 목표로.
- **② AI 사용 공개 블록 (자동 생성).** learnist의 3-part formula를 구조화 필드로: `AI가 한 일 / 내가 소유한 결정 / 어떻게 검증했나`. Builder's Diary는 세션 로그에서 이걸 **자동으로** 뽑을 수 있는 유일한 위치에 있음 — 손으로 쓴 disclosure보다 신뢰도가 구조적으로 높다. 이것이 최대 차별화 기회.
- **③ 검증 트레일(Proof의 하위 구조화).** Proof를 자유 텍스트가 아니라 타입 있는 증거 슬롯으로: 배포 URL / 커밋·PR 링크 / 테스트·검증 결과 / before-after / 스크린샷·Loom. "'the model said it worked' isn't a defence" 기준을 UI로 강제. 증거 타입별 아이콘으로 스캔 가능하게.
- **④ 'AI got it wrong' 카드 태그.** 실패를 진단·복구한 세션을 별도 태그/필터로. "완벽 갤러리보다 처리된 실패가 성과가 좋다"(Lovart), "마찰 없는 포트폴리오는 편집된 것으로 읽힌다"(Backes). 리크루터 뷰에 "실패 복구 사례 보기" 진입점 제공.
- **⑤ 소유권 표기(ownership) 필드.** "I did X, as part of a team that did Y" 패턴을 카드 스키마에 — 특히 협업 세션에서. 모호한 소유권은 1순위 탈락 사유.
- **⑥ 속도/효율 지표(비즈니스 언어).** 세션 메타데이터에서 뽑을 수 있는 프록시: 소요 시간, 이터레이션 횟수, 첫 수용 가능 산출물까지의 시간. 가짜 매출 지표 금지 — 프록시임을 명시(Lovart의 "Do not invent fake revenue. Proxies are fine").
- **⑦ 일관성 링크 레이어.** 카드·프로필에서 GitHub/LinkedIn/이력서로의 교차 링크. 리크루터는 반드시 크로스체크하며, 해석 비용이 낮은 후보를 택한다(Open Doors). 모바일 대응 필수(55초 연구에서 매니저 4명이 모바일로 리뷰).
- **⑧ (선택) 90초 워크스루.** 케이스 1개에 대한 짧은 Loom/음성 내레이션 슬롯 — "Ninety seconds to three minutes. One project. Decisions only."(Lovart). 전 카드 강제 아님.

### 요약 문장
> 2026년의 증거는 창업자의 직감을 지지한다: **judgment는 죽일 게 아니라 강등할 것.** 척추는 outcome-first(55초 스캔 통과), judgment는 케이스 중간의 정예화된 터닝포인트(2–3분 정독 구간용), 그리고 Builder's Diary의 진짜 해자는 **세션 로그에서 자동 생성되는 AI-공개 블록 + 타입 있는 검증 트레일** — 손으로 못 위조하는 증거 구조다.
