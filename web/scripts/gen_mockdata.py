import json, io

tag_categories = {
    "마인드셋": ["비용 감각", "검증 규율", "무인 실행 설계", "자기 오류 교정", "문서보다 실행 흔적"],
    "도구": ["claude code", "Next.js", "Supabase", "PostgreSQL", "vLLM",
             "Playwright", "lm-eval-harness", "Docker", "Redis", "LoRA", "end-to-end"],
}

_cid = 0
def card(title, summary, content, result, mindset, tools, date, status):
    global _cid
    _cid += 1
    return {"id": f"card-{_cid}", "title": title, "summary": summary, "content": content,
            "result": result, "mindsetTags": mindset, "toolTags": tools,
            "created_at": date, "status": status}

projects = []

projects.append({"id":"project-bd-v2","title":"Builder's Diary V2","description":"포트폴리오 자동 기록 시스템 개선","goals":[
 {"id":"goal-ui-redesign","title":"UI 레이아웃 재설계","description":"목표 리스트 + 작업 카드 + 상세 패널의 3-zone 레이아웃으로 재구성","cards":[
  card("상단 필터 바 구현 (프로젝트/목표 선택)","드롭다운 + 키워드 검색으로 프로젝트·목표를 빠르게 전환","헤더 아래에 프로젝트/목표 두 개의 서처블 드롭다운을 배치했다. 타이핑하면 후보가 실시간으로 좁혀지고, 선택 즉시 카드 목록이 갱신된다. 목표 드롭다운은 선택된 프로젝트의 목표만 노출하도록 종속시켰다.","프로젝트 3개·목표 10개 기준 두 글자 입력에 후보가 1~2개로 좁혀짐 확인.",["검증 규율","무인 실행 설계"],["Next.js"],"2026-09-04","in_progress"),
  card("좌측 목표 리스트 컴포넌트","선택된 프로젝트의 목표를 세로 리스트로, 클릭 시 카드 필터","왼쪽 고정 폭 컬럼에 목표를 세로로 쌓고 각 항목에 카드 개수 배지를 붙였다. 클릭하면 selectedGoalId가 바뀌고 상단 드롭다운과 상태를 공유한다.","목표 클릭 → 중앙 카드가 해당 목표 것만 남는 흐름 동작 확인.",["문서보다 실행 흔적"],["Next.js"],"2026-09-04","in_progress"),
  card("중앙 카드 스크롤 영역 (좌우 스크롤)","작업 카드를 가로로 스크롤하며 탐색, 앞면은 제목만","카드를 flex-row + overflow-x-auto로 배치하고 scroll-snap을 걸었다. 앞면은 제목·태그·상태만 노출해 스캔 속도를 높였다. 스크롤바는 3px로 최소화.","카드 8개 이상일 때 가로 스크롤·스냅 정상, 세로 스크롤과 충돌 없음.",["검증 규율"],["Next.js"],"2026-09-03","completed"),
  card("우측 사이드 패널 (상세 정보)","카드 클릭 시 제목·요약·상세·결과·태그·상태를 우측 패널에 표시","카드를 클릭하면 오른쪽에서 상세 패널이 열린다. 작업 내용과 결과를 나눠 보여주고, 닫기 버튼으로 카드 영역을 다시 전체 폭으로 되돌린다.","카드 클릭 → 우측 패널 오픈 → 닫기 → 카드 폭 복원 왕복 확인.",["비용 감각"],["Next.js"],"2026-09-03","completed"),
  card("반응형 레이아웃 (태블릿/모바일)","좁은 화면에서 3-zone을 적층 구조로 재배치","lg 미만에서 목표 리스트를 접고, md 미만에서 상세 패널을 하단 시트로 내렸다. 카드 가로 스크롤은 터치에서도 유지.","768px·480px 뷰포트에서 레이아웃 깨짐 없이 카드 접근 가능 확인.",["자기 오류 교정","문서보다 실행 흔적"],["Next.js"],"2026-09-02","in_progress"),
  card("Variant A 다크 테마 토큰 정리","#0e0e0e / #4ade80 팔레트를 CSS 변수로 통일","흩어져 있던 색상 하드코딩을 :root 변수로 모으고 컴포넌트가 var()만 참조하게 했다. 강조색은 accent 하나로 수렴.","그렙으로 하드코딩 색상 잔여 0건 확인.",["검증 규율"],["Next.js"],"2026-09-01","completed"),
  card("온보딩 화면 재작성 (프로젝트 연결 + 가이드)","폴더 연결 전에는 연결 버튼과 3단계 가이드만 노출","연결 전 상태를 별도 화면으로 분리했다. 신규/기존 폴더 선택, MCP 연결, 에이전트 채팅에서 @스킬 호출까지 3단계를 카드로 안내한다.","portfolio 미연결 시 온보딩만, 연결 후 메인만 렌더됨을 상태 토글로 확인.",["무인 실행 설계","문서보다 실행 흔적"],["claude code"],"2026-09-04","in_progress"),
 ]},
 {"id":"goal-state-mgmt","title":"상태 관리 시스템","description":"프로젝트/목표/카드 선택 상태를 중앙화하고 URL·저장소와 동기화","cards":[
  card("선택 상태 중앙화 (project/goal/card)","3개 선택 상태를 한 곳에서 관리해 컴포넌트 간 전파","selectedProjectId·selectedGoalId·selectedRecordId를 상위 컨테이너로 끌어올리고 자식엔 props로만 내렸다. 필터 로직은 useMemo로 파생.","프로젝트 변경 시 목표·카드 선택이 초기화되는 규칙 동작 확인.",["검증 규율","문서보다 실행 흔적"],["Next.js"],"2026-09-03","completed"),
  card("필터 변경 시 카드 자동 갱신","프로젝트/목표/태그/키워드 어느 것이 바뀌어도 카드 재계산","filteredRecords를 4개 의존성(project·goal·tags·keyword)의 useMemo로 묶었다. 목표 미선택 시 프로젝트 전체 카드를 flat하게 노출.","각 필터 단독·조합 변경에서 카드 목록 즉시 반영 확인.",["검증 규율"],["Next.js"],"2026-09-02","completed"),
  card("localStorage 선택 상태 복구","새로고침 후에도 마지막 프로젝트·목표 선택 유지","선택 상태를 직렬화해 localStorage에 저장하고 마운트 시 복원한다. 저장된 id가 현재 데이터에 없으면 첫 항목으로 폴백.","새로고침 후 마지막 선택 복원, 삭제된 id는 안전 폴백 확인.",["자기 오류 교정","비용 감각"],["Next.js"],"2026-09-02","blocked"),
  card("URL 쿼리스트링 동기화","선택 상태를 URL에 반영해 링크로 공유 가능하게","project·goal·record를 쿼리스트링에 반영하고, 진입 시 파싱해 초기 상태로 세팅한다. 뒤로가기와도 일관되게 동작.","딥링크 진입 시 해당 프로젝트·목표·카드가 선택된 채 렌더 확인.",["검증 규율"],["Next.js","end-to-end"],"2026-09-01","in_progress"),
  card("TypeScript 타입 정의 정리","Record/Goal/Project/Portfolio 및 태그 카테고리 타입 확정","데이터 모델을 types.ts로 모으고 mindsetTags/toolTags/result 필드를 추가했다. 파서·목데이터가 같은 타입을 공유하게 정렬.","tsc 프로젝트 빌드에서 타입 에러 0 확인.",["검증 규율","문서보다 실행 흔적"],["Next.js"],"2026-09-01","completed"),
  card("필터 상태 리셋 규칙 정의","폴더 재연결·프로젝트 변경 시 하위 선택 초기화","상위 선택이 바뀌면 하위(goal·card·keyword)를 비우는 규칙을 한 곳에 모았다. 예상 밖 잔여 선택으로 빈 카드가 뜨는 버그를 막음.","프로젝트 전환 후 이전 목표 필터가 남지 않음을 확인.",["자기 오류 교정"],["Next.js"],"2026-08-31","in_progress"),
 ]},
 {"id":"goal-testing","title":"테스트 & 성능","description":"필터·스크롤 성능을 계측하고 회귀를 자동으로 잡는다","cards":[
  card("필터링 성능 벤치마크","카드 1000개 기준 필터 응답 시간 측정","합성 데이터 1000장으로 필터 재계산 시간을 측정하고 useMemo 유무를 비교했다. 병목은 태그 매칭 루프였다.","메모이제이션 적용 후 재계산 12ms → 2ms (콘솔 계측).",["비용 감각","검증 규율"],["Next.js"],"2026-09-02","completed"),
  card("가상 스크롤 도입 검토","카드가 많을 때 보이는 영역만 렌더","카드 수가 200을 넘는 경우를 대비해 윈도잉 라이브러리 도입을 스파이크했다. 현재 규모(65장)에선 과설계로 판단해 보류.","65장 기준 일반 렌더 60fps 유지 — 도입 보류 결정 기록.",["자기 오류 교정","비용 감각"],["Next.js"],"2026-09-01","blocked"),
  card("E2E 시나리오 작성 (필터 흐름)","프로젝트→목표→카드 클릭→상세까지 자동 검증","Playwright로 핵심 흐름을 스크립트화했다. 드롭다운 검색 입력, 목표 선택, 카드 클릭, 상세 패널 텍스트 검증까지 커버.","핵심 흐름 e2e 1건 그린 — CI에서 재현 확인.",["문서보다 실행 흔적","검증 규율"],["Playwright","end-to-end"],"2026-09-01","in_progress"),
  card("빈 상태 렌더 검증","태그 필터로 카드가 전부 걸러졌을 때 안내 + 초기화","필터 결과가 0장인 경우와 프로젝트에 카드가 아예 없는 경우를 구분해 문구를 다르게 냈다. 초기화 버튼으로 복구.","두 빈 상태 각각 문구·초기화 버튼 노출 확인.",["자기 오류 교정"],["Next.js"],"2026-08-31","completed"),
  card("프로덕션 빌드 회귀 체크","next build 통과와 정적 페이지 생성 확인","타입·린트·정적 생성까지 한 번에 도는 빌드를 회귀 게이트로 삼았다. 커밋 전 로컬에서 강제.","next build Compiled successfully / 4 static pages 확인.",["검증 규율","문서보다 실행 흔적"],["Next.js","Docker"],"2026-08-30","completed"),
  card("접근성 키보드 내비게이션","Tab·Enter로 카드 이동·선택 가능하게","카드에 tabindex와 키 핸들러를 붙여 Enter로 상세를 열 수 있게 했다. 포커스 링을 accent로 표시.","마우스 없이 Tab→Enter로 상세 오픈 동작 확인.",["자기 오류 교정"],["Next.js"],"2026-08-29","in_progress"),
 ]},
 {"id":"goal-mcp","title":"MCP 서버 연동","description":"에이전트 채팅에서 @스킬 호출로 기록을 자동 적재","cards":[
  card("MCP stdio 서버로 전환","Flask HTTP 래퍼를 표준 MCP stdio 프로토콜로 교체","HTTP 래퍼를 걷어내고 stdio 기반 MCP 서버로 다시 짰다. 툴 목록·입력 스키마를 명세에 맞게 노출.","MCP inspector에서 툴 3종 정상 노출·호출 확인.",["문서보다 실행 흔적","검증 규율"],["claude code","Docker"],"2026-09-04","completed"),
  card("@builders-diary 스킬 호출 규약","채팅에서 스킬명 콜로 기록 생성 트리거","Claude/Cursor 채팅에서 @builders-diary를 부르면 현재 세션 흔적에서 한 편을 만들도록 스킬 트리거를 정의했다.","샘플 세션에서 스킬 콜 → entries/ 마크다운 1건 생성 확인.",["무인 실행 설계","문서보다 실행 흔적"],["claude code"],"2026-09-04","in_progress"),
  card("프론트매터 파서 정합성","마크다운 YAML 프론트매터를 Record로 안정 파싱","필수 필드 누락·태그 배열 표기 흔들림을 방어적으로 파싱했다. 파싱 실패 시 해당 파일만 건너뛰고 로그.","필드 누락 샘플에서 크래시 없이 스킵됨 확인.",["검증 규율","자기 오류 교정"],["claude code"],"2026-09-03","in_progress"),
  card("폴더 스캔 → 포트폴리오 매핑","content/projects-*/goals/*/records 구조를 트리로 변환","File System Access API로 폴더를 순회해 프로젝트·목표·레코드 트리를 만든다. 권한 프롬프트와 재연결도 처리.","샘플 폴더 스캔 → 3계층 트리 구성 확인.",["무인 실행 설계"],["Next.js","end-to-end"],"2026-09-02","in_progress"),
  card("Docker 이미지 최소화","MCP 서버 이미지에서 불필요 의존성 제거","베이스 이미지를 슬림으로 바꾸고 빌드 산출물만 복사하도록 다단계 빌드로 정리했다.","이미지 크기 감소, 컨테이너 stdio 기동 확인.",["비용 감각","자기 오류 교정"],["Docker"],"2026-09-01","completed"),
  card("배포 파이프라인 점검","스킬 호출부터 웹 반영까지 end-to-end 확인","채팅 스킬 콜 → 마크다운 생성 → 폴더 스캔 → 웹 카드 노출까지 한 흐름을 손으로 밟았다.","샘플 기록이 웹 카드로 노출되는 전 경로 1회 성공.",["문서보다 실행 흔적","무인 실행 설계"],["end-to-end","Docker"],"2026-08-30","blocked"),
 ]},
]})

projects.append({"id":"project-supabase-cost","title":"Supabase 비용 최적화","description":"공개 보드 egress·DB 운영비를 계측하고 절감","goals":[
 {"id":"goal-cost-tracking","title":"비용 추적 시스템","description":"egress·서비스별 비용을 계측하고 잔차를 추적","cards":[
  card("egress 계측기 삽입 (httpx 훅)","파이썬 클라이언트 요청마다 egress_mb 컬럼 기록","httpx 훅으로 각 런의 응답 바이트를 합산해 run_log에 egress_mb를 남겼다. 다만 브라우저 직접 요청은 원리적으로 못 잡는다는 걸 독스트링에 명시.","계측 로그 [EGRESS] 91줄 확보, 파이프라인 합계 1,225MB 집계.",["검증 규율","문서보다 실행 흔적"],["Supabase","PostgreSQL"],"2026-09-02","completed"),
  card("잔차 추적: 계측 14% vs 청구서 100%","계측된 게 전체의 14%뿐 — 나머지 86% 출처 추적","청구서 8.51GB 대비 파이프라인 계측은 1.23GB. 잔차 7.28GB의 출처를 브라우저·미계측 스크립트·Studio로 분해했다.","잔차 86% 확인 — 단일 범인 단정 금지 원칙 수립.",["자기 오류 교정","검증 규율"],["Supabase"],"2026-09-02","in_progress"),
  card("프론트엔드 쿼리 바이트 재현","브라우저가 던지는 쿼리를 curl로 그대로 재현 측정","PublicBoard·Dashboard 쿼리를 컬럼 목록까지 복제해 gzip 헤더를 붙여 측정했다. select('*')가 방문자당 395KB였다.","대시보드 1회 오픈 = 웜 13.9MB / 콜드 23.3MB 측정.",["검증 규율","무인 실행 설계"],["Supabase","PostgreSQL"],"2026-09-01","completed"),
  card("압축 단위 판별 (gzip vs raw)","청구가 압축 후 기준인지 단일 요인 날로 판별","scrape만 돈 8/26을 골라 계측치와 청구액을 비교했다. 비압축 가정이면 물리적으로 불가능 → 압축 청구 확정.","8/26 계측 78.2MB / 실제 108.6MB → 압축 청구 확정.",["검증 규율","자기 오류 교정"],["Supabase"],"2026-08-31","completed"),
  card("공개 보드 정적 스냅샷 분리","방문자당 395KB egress를 0으로 — 9/12 방어","공개 보드를 PostgREST 직격에서 떼어내 정적 스냅샷으로 서빙하도록 전환 착수. 방문자 egress를 0에 수렴시키는 게 목표.","방문자당 395KB → 0 목표 설정, 전환 작업 진행 중.",["비용 감각","무인 실행 설계"],["Supabase","Next.js"],"2026-08-30","in_progress"),
  card("폴링 주기 5초 → 30초","daemon 폴링이 바닥 egress를 만든다 — 주기 완화","5초 폴링 17,280회/일이 응답 960B씩 바닥값을 만들고 있었다. 주기를 30초로 늘려 폴링 몫을 1/6로.","9/1 파이프라인 0인데 11.6MB = 폴링 바닥값 확인 → 주기 완화.",["비용 감각","검증 규율"],["PostgreSQL"],"2026-08-29","in_progress"),
  card("fetchEvaluations 컬럼 분리","13MB 쿼리를 필요한 컬럼만 골라 ~1.5MB로","select('*')로 무거운 JSON 행을 통째로 끌어오던 걸 필요한 컬럼만 뽑도록 바꿨다. 19,714행이 전부 무거운 행이었음.","fetchEvaluations 13.0MB → ~1.5MB 목표로 컬럼 분리 착수.",["비용 감각","자기 오류 교정"],["PostgreSQL","Supabase"],"2026-08-28","in_progress"),
  card("비용 화면 자기잠식 인지","/admin 여는 것 자체가 14MB egress","비용을 보려고 대시보드를 여는 행위가 다시 egress를 만드는 자기잠식을 확인했다. 계측 화면은 정적 수치만 읽도록 방침 수정.","/admin 1회 오픈 = 14MB — 계측이 자기를 갉아먹음 기록.",["자기 오류 교정","비용 감각"],["Supabase"],"2026-08-27","blocked"),
 ]},
 {"id":"goal-db-perf","title":"DB 성능 개선","description":"쿼리 속도와 응답시간을 계측 기반으로 개선","cards":[
  card("슬로우 쿼리 프로파일링","EXPLAIN ANALYZE로 병목 쿼리 식별","슬로우 쿼리 로그를 켜고 상위 쿼리에 EXPLAIN ANALYZE를 돌려 풀스캔 지점을 찾았다.","상위 5개 쿼리 중 3개가 seq scan — 인덱스 후보 도출.",["검증 규율","문서보다 실행 흔적"],["PostgreSQL"],"2026-08-26","completed"),
  card("인덱스 추가 (쿼리 비용 -23%)","자주 필터되는 컬럼에 복합 인덱스","seq scan이던 쿼리에 복합 인덱스를 추가하고 전후 비용을 비교했다. 쓰기 오버헤드도 함께 계측.","대상 쿼리 평균 실행비용 -23% (EXPLAIN 비교).",["자기 오류 교정","검증 규율"],["PostgreSQL"],"2026-08-25","completed"),
  card("N+1 제거 (쿼리 수 -40%)","반복 단건 조회를 JOIN·배치 로딩으로","리스트 렌더마다 행별로 추가 쿼리를 던지던 걸 JOIN과 배치 로딩으로 묶었다.","페이지당 쿼리 수 -40% 확인.",["자기 오류 교정","검증 규율"],["PostgreSQL"],"2026-08-24","completed"),
  card("Redis 캐싱 도입","자주 조회하는 집계값을 캐시","변하지 않는 집계 결과를 Redis에 캐시하고 무효화 규칙을 정했다. 캐시 히트율을 로그로 남김.","핫 집계 쿼리 캐시 히트율 측정 시작 — DB 부하 감소 관찰.",["비용 감각","무인 실행 설계"],["Redis","PostgreSQL"],"2026-08-23","in_progress"),
  card("월별 파티셔닝 설계","대용량 테이블을 월 단위로 분할","조회가 대부분 최근 데이터에 몰리는 걸 근거로 월별 파티셔닝을 설계했다. 과거 파티션은 콜드 스토리지 후보.","최근 파티션 조회 시 스캔 범위 축소 설계 확정.",["검증 규율"],["PostgreSQL"],"2026-08-22","in_progress"),
  card("커넥션 풀링 (PgBouncer)","동시 연결 수를 제한해 비용·불안정 완화","PgBouncer를 앞에 두고 트랜잭션 모드로 연결을 재사용하게 했다.","동시 연결 상한 적용, 피크 시 연결 고갈 사라짐 확인.",["비용 감각","자기 오류 교정"],["PostgreSQL","Docker"],"2026-08-21","in_progress"),
 ]},
 {"id":"goal-auth-sec","title":"인증 & 보안","description":"토큰·RLS·레이트리밋으로 접근을 통제","cards":[
  card("JWT access/refresh 분리","만료시간을 짧게, 갱신은 refresh로","access 토큰을 짧게 두고 refresh로 조용히 갱신하는 흐름을 넣었다. 만료·재발급 경로를 e2e로 확인.","토큰 만료 후 자동 재발급 흐름 정상 확인.",["검증 규율","문서보다 실행 흔적"],["Supabase","end-to-end"],"2026-08-20","completed"),
  card("행 레벨 보안(RLS) 정책 점검","사용자별 데이터 접근 권한 재검토","RLS 정책을 케이스별로 다시 훑고, anon 키로 접근 가능한 표면을 좁혔다.","anon 키로 접근되던 표면 축소 — 정책 갭 목록화.",["자기 오류 교정","검증 규율"],["Supabase","PostgreSQL"],"2026-08-19","in_progress"),
  card("API 레이트리밋 적용","사용자당 시간당 요청 상한","남용·폴링 폭주를 막기 위해 사용자·IP 단위 레이트리밋을 넣었다.","상한 초과 시 429 반환 동작 확인.",["비용 감각","무인 실행 설계"],["PostgreSQL"],"2026-08-18","in_progress"),
  card("service 키 노출 표면 점검","프론트에서 service 키 사용 흔적 제거","프론트 번들에 service 키가 섞이지 않는지 그렙으로 훑고, anon 경로로 강제했다.","번들 내 service 키 잔여 0건 확인.",["자기 오류 교정","검증 규율"],["Supabase","Next.js"],"2026-08-17","completed"),
  card("감사 로그 수집","민감 작업에 대한 감사 트레일 남기기","권한 변경·삭제 같은 민감 작업에 감사 로그를 남기도록 트리거를 붙였다.","민감 작업 3종에 대해 감사 로그 적재 확인.",["문서보다 실행 흔적","무인 실행 설계"],["PostgreSQL"],"2026-08-16","in_progress"),
  card("비밀값 환경변수 이관","하드코딩 키를 환경변수·시크릿으로","코드에 남아있던 키를 .env·시크릿 매니저로 옮기고 로테이션 절차를 문서화했다.","하드코딩 비밀값 0건, 로테이션 절차 기록.",["검증 규율","자기 오류 교정"],["Docker"],"2026-08-15","completed"),
 ]},
]})

projects.append({"id":"project-llm-evals","title":"LLM 평가 및 최적화","description":"모델 벤치마크·파인튜닝·서빙을 계측 기반으로 운영","goals":[
 {"id":"goal-benchmark","title":"모델 벤치마크 시스템","description":"표준 벤치마크를 자동 실행하고 비용-성능을 비교","cards":[
  card("lm-eval-harness 통합","MMLU·GSM8K 등 표준 벤치를 자동 실행","harness를 파이프라인에 붙여 모델·태스크 조합을 한 번에 돌리고 결과를 저장하게 했다.","MMLU·GSM8K 자동 실행·결과 적재 확인.",["문서보다 실행 흔적","검증 규율"],["lm-eval-harness"],"2026-08-30","completed"),
  card("Claude/GPT-4/Llama-2 비교","동일 프롬프트로 응답 품질 스코어링","같은 프롬프트 세트로 세 모델을 돌려 정확도·형식 준수를 채점했다.","세 모델 정확도 표 확보 — 태스크별 우열 분리.",["검증 규율","비용 감각"],["lm-eval-harness"],"2026-08-28","completed"),
  card("비용-성능 그래프","토큰 가격 대비 정확도 시각화","모델별 토큰 단가와 벤치 정확도를 한 평면에 찍어 파레토 프론트를 봤다.","비용-정확도 산점도 생성 — 저비용 상위 후보 식별.",["비용 감각","검증 규율"],["lm-eval-harness","Next.js"],"2026-08-26","in_progress"),
  card("커스텀 평가 지표","도메인용 코드 정확성 스코어러","단순 문자열 일치 대신 실행 기반 코드 정확성 지표를 붙였다. 실행 샌드박스에서 채점.","코드 태스크에 실행 기반 채점 적용 확인.",["자기 오류 교정","검증 규율"],["lm-eval-harness","Docker"],"2026-08-24","in_progress"),
  card("월별 벤치 리포트 자동화","성능 추이를 매월 자동 집계·알림","harness 결과를 월 단위로 모아 추이 표를 만들고 슬랙으로 알림 보내게 했다.","월간 추이 리포트 1회 자동 생성 확인.",["무인 실행 설계","문서보다 실행 흔적"],["lm-eval-harness"],"2026-08-22","in_progress"),
  card("A/B 프레임워크","두 모델 비교의 통계 유의성 검증","응답 선호를 수집해 두 모델 차이가 유의한지 검정하는 틀을 만들었다.","샘플 수 부족으로 유의성 미달 — 수집 계속 (blocked).",["검증 규율","무인 실행 설계"],["lm-eval-harness"],"2026-08-20","blocked"),
 ]},
 {"id":"goal-finetune","title":"파인튜닝 & 최적화","description":"특정 태스크용 모델 커스터마이즈와 경량화","cards":[
  card("학습 데이터 큐레이션","코드 생성용 500개 예제 정제","중복·저품질 예제를 걸러 코드 생성 태스크용 500개를 큐레이션했다. 라이선스도 함께 점검.","정제 후 500예제 확정 — 중복 제거율 기록.",["검증 규율","문서보다 실행 흔적"],["LoRA"],"2026-08-25","completed"),
  card("LoRA 파인튜닝 실험","Llama-2에 LoRA 적용, 학습곡선 추적","LoRA 어댑터로 저비용 파인튜닝을 돌리고 손실 곡선을 추적했다.","학습 손실 수렴 확인 — 과적합 조짐 모니터링 중.",["자기 오류 교정","검증 규율"],["LoRA"],"2026-08-23","in_progress"),
  card("하이퍼파라미터 그리드 서치","학습률·배치·에포크 최적화","작은 그리드로 핵심 3개 파라미터를 훑고 검증 손실로 골랐다. 비용 상한을 미리 정해둠.","검증 손실 최소 조합 도출 — 탐색 비용 상한 내 완료.",["비용 감각","검증 규율"],["LoRA"],"2026-08-21","in_progress"),
  card("파인튜닝 vs 기본 비교","테스트셋에서 BLEU/ROUGE 측정","파인튜닝 모델과 기본 모델을 같은 테스트셋으로 채점해 개선폭을 봤다.","대상 태스크에서 기본 대비 점수 상승 확인.",["검증 규율","문서보다 실행 흔적"],["lm-eval-harness","LoRA"],"2026-08-19","in_progress"),
  card("4bit 양자화 (크기 -30%)","배포 크기·속도 개선을 위한 양자화","4비트 양자화 후 정확도 손실과 크기·속도 이득을 함께 쟀다.","모델 크기 -30%, 정확도 손실 허용 범위 내 확인.",["비용 감각","자기 오류 교정"],["vLLM","LoRA"],"2026-08-17","in_progress"),
  card("추론 지연 프로파일","토큰/초·TTFT 병목 계측","배치 크기·시퀀스 길이별로 TTFT와 처리량을 계측해 병목을 찾았다.","배치별 처리량 곡선 확보 — 최적 배치 구간 식별.",["검증 규율","비용 감각"],["vLLM"],"2026-08-16","completed"),
 ]},
 {"id":"goal-serve","title":"배포 & 모니터링","description":"프로덕션 서빙과 성능 모니터링을 구성","cards":[
  card("vLLM 서버 구성","GPU 최적화 추론 서버 배포","vLLM로 연속 배칭 서버를 띄우고 동시성을 이전 대비 끌어올렸다.","동시성 3배 증대·기동 확인.",["검증 규율","무인 실행 설계"],["vLLM","Docker"],"2026-08-30","completed"),
  card("OpenAI 호환 API 래퍼","vLLM 엔드포인트를 OpenAI 형식으로 노출","기존 클라이언트가 그대로 붙도록 OpenAI 호환 스키마로 감쌌다.","기존 SDK로 무수정 호출 성공 확인.",["문서보다 실행 흔적","무인 실행 설계"],["vLLM","end-to-end"],"2026-08-28","completed"),
  card("실시간 성능 대시보드","토큰/초·응답시간·GPU 메모리 추적","서빙 지표를 실시간으로 모아 대시보드에 띄웠다. 임계 초과를 색으로 표시.","3개 핵심 지표 실시간 갱신 확인.",["검증 규율","비용 감각"],["vLLM","Next.js"],"2026-08-26","in_progress"),
  card("에러율 임계 자동 롤백","5% 초과 시 이전 버전으로 자동 복귀","에러율이 임계를 넘으면 배포를 자동으로 되돌리는 훅을 넣었다.","합성 장애 주입 시 자동 롤백 발동 확인.",["자기 오류 교정","무인 실행 설계"],["Docker","end-to-end"],"2026-08-24","in_progress"),
  card("Kubernetes 오토스케일","부하에 따라 추론 레플리카 자동 확장","HPA로 처리량 지표 기반 스케일링을 걸고 콜드스타트를 완화했다.","부하 증가 시 레플리카 확장 동작 확인.",["무인 실행 설계","비용 감각"],["Docker"],"2026-08-22","in_progress"),
  card("배포 버전 관리","모델 버전별 성능 기록·롤백","버전마다 벤치 점수·서빙 지표를 함께 저장해 손쉬운 롤백 근거로 삼았다.","버전별 성능 기록 적재·롤백 경로 확인.",["검증 규율","자기 오류 교정"],["Docker","lm-eval-harness"],"2026-08-20","in_progress"),
  card("사용자 피드백 루프","thumbs up/down 수집을 개선에 연결","응답 평가를 수집해 재학습 후보 데이터로 흘려보내는 경로를 만들었다.","피드백 수집 → 데이터셋 적재 경로 1회 성공.",["문서보다 실행 흔적","무인 실행 설계"],["end-to-end","LoRA"],"2026-08-18","in_progress"),
 ]},
]})

assert len(projects) == 3
for p in projects:
    assert 3 <= len(p["goals"]) <= 4, p["id"]
    for g in p["goals"]:
        assert 6 <= len(g["cards"]) <= 8, (p["id"], g["id"], len(g["cards"]))
mind = set(tag_categories["마인드셋"]); tool = set(tag_categories["도구"])
bad = []
for p in projects:
    for g in p["goals"]:
        for c in g["cards"]:
            for t in c["mindsetTags"]:
                if t not in mind: bad.append(("mindset", t, c["id"]))
            for t in c["toolTags"]:
                if t not in tool: bad.append(("tool", t, c["id"]))
assert not bad, bad
total = sum(len(g['cards']) for p in projects for g in p['goals'])

def ts(v, ind=0):
    sp = "  "*ind
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        if not v: return "[]"
        if all(isinstance(x, str) for x in v):
            return "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in v) + "]"
        items = ",\n".join(sp+"  "+ts(x, ind+1) for x in v)
        return "[\n"+items+"\n"+sp+"]"
    if isinstance(v, dict):
        lines = [f"{sp}  {k}: {ts(val, ind+1)}" for k,val in v.items()]
        return "{\n"+",\n".join(lines)+"\n"+sp+"}"
    return json.dumps(v)

out = io.StringIO()
out.write("// V2 임시 데이터 — 3 프로젝트 × 3~4 목표 × 6~8 작업 카드\n")
out.write("// 실제 감각을 위해 태그·상태·날짜를 있을 법하게 구성한 목업.\n\n")
out.write("export type CardStatus = 'in_progress' | 'completed' | 'blocked';\n\n")
out.write("""export interface CardData {
  id: string;
  title: string;
  summary: string;
  content: string;
  result: string;
  mindsetTags: string[];
  toolTags: string[];
  created_at: string;
  status: CardStatus;
}

export interface GoalData {
  id: string;
  title: string;
  description: string;
  cards: CardData[];
}

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  goals: GoalData[];
}

export interface MockPortfolioV2 {
  tagCategories: { [category: string]: string[] };
  projects: ProjectData[];
}

""")
out.write("export const tagCategories: { [category: string]: string[] } = ")
out.write(ts(tag_categories, 0)); out.write(";\n\n")
out.write("export const mockPortfolioV2: MockPortfolioV2 = {\n")
out.write("  tagCategories,\n")
out.write("  projects: "); out.write(ts(projects, 1)); out.write(",\n};\n")

path = "/Users/taegyujeong/work/builders-diary/web/src/lib/mockData.ts"
with open(path, "w") as f:
    f.write(out.getvalue())
print("WROTE", path)
print("projects:", len(projects), "| total cards:", total, "| last cid:", _cid)
for p in projects:
    print(" ", p["title"], "goals=", len(p["goals"]), "cards=", [len(g["cards"]) for g in p["goals"]])
