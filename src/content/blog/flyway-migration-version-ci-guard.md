---
title: "병렬 브랜치 마이그레이션 버전 충돌을 CI로 막기 — required check 의 함정까지"
description: "Flyway 의 버전 단조증가·체크섬 불변 전제를 정적 가드 스크립트와 GitHub strict ruleset 조합으로 pre-merge 에 강제한 사례를 정리합니다."
pubDate: "2026-06-29T10:09:43+09:00"
category: "DevOps"
tags: ["flyway", "ci", "github-actions", "migration", "fail-closed"]
---
이 글은 [운영 DB에 Flyway 처음 도입하기](../flyway-production-introduction/)에서 예고한 후속편으로, 병렬 PR이 같은 마이그레이션 버전을 채번해 생기는 충돌을 CI 단계에서 정적으로 막는 가드(Class A)를 다룬다.

## 문제: Flyway 의 전제는 사람이 지켜주길 기대한다

Flyway 는 두 가지를 **암묵적인 전제**로 깔고 동작한다.

- **버전은 단조 증가한다.** `V1`, `V2`, `V3`... 순서로 한 번 적용된 버전은 다시 내려가지 않는다.
- **이미 적용된 마이그레이션의 내용(체크섬)은 변하지 않는다.** 적용 후 파일을 수정하면 다음 부팅에서 `validate` 가 깨진다.

문제는 이 전제를 **도구가 pre-merge 에 강제해주지 않는다**는 점이다. ORM(Hibernate `ddl-auto=validate`)은 엔티티와 실제 스키마의 정합만 검증할 뿐 버전 채번에는 관심이 없고, Flyway 본체는 마이그레이션이 **실행되는 시점**에야 충돌을 발견한다. 즉 사고가 이미 머지되어 다른 환경에 배포될 때 터진다.

가장 흔한 두 사고는 이렇다.

**(1) 병렬 브랜치의 동일 버전 채번.** 열린 PR 두 개가 각각 `main` 기준으로 분기해 둘 다 `V7__add_x.sql`, `V7__add_y.sql` 로 채번했다고 하자. 로컬에서는 둘 다 멀쩡히 통과한다. 그런데 한쪽이 먼저 머지되면 `main` 에는 이미 `V7` 이 존재한다. 뒤 PR 의 `V7` 은 머지 시점엔 충돌이 드러나지 않다가, 운영 DB 에서 "이미 적용된 V7" 과 부딪혀 깨지거나 조용히 무시된다. 머지 순서에 따라 결과가 달라지는, 재현하기 까다로운 사고다.

**(2) 이미 머지된 파일 수정.** 적용이 끝난 `V3__init.sql` 을 누군가 "오타 하나만" 고치면 체크섬이 바뀐다. 그 순간부터 그 파일을 이미 적용한 **모든 환경**에서 `validate` 가 실패한다. 운영 롤백은 forward-only 가 원칙이므로, 고치려면 또 새 마이그레이션을 쌓아야 한다.

이런 사고를 코드리뷰어의 눈에만 맡길 수는 없다. 버전 번호 충돌은 diff 만 봐서는 보이지 않고(다른 PR 의 파일은 이 PR diff 에 없다), 체크섬 변경은 "한 글자 수정" 으로 위장한다. 그래서 **정적 가드를 CI 의 required check 로 박아두기로** 했다 (PLA-1612, Class A).

## 해결책: PR diff 기준 4개 불변식 정적 검사

핵심은 `scripts/check-migration-versions.sh` 한 본이다. PR 의 diff 를 base(`origin/main`) 와 비교해 다음 4개 불변식을 검사한다.

1. **파일명 규칙** — `V<정수>__<설명>.sql`. 점버전(`V2.1__`)·Repeatable(`R__`)은 현재 미사용이므로 거부한다.
2. **이미 머지된 마이그레이션 수정/삭제/이름변경 금지** — 체크섬 보존 · forward-only.
3. **이 PR 이 추가한 버전끼리 중복 금지.**
4. **추가된 모든 버전 > base 최대 버전** — out-of-order 와 병렬 채번 충돌을 함께 차단.

스크립트는 `set -euo pipefail` 로 시작하고, 검사 대상 디렉토리와 base 를 환경에서 받는다. CI 가 주입하는 `GITHUB_BASE_REF` 가 없으면 로컬 실행을 위해 `main` 으로 떨어진다.

```bash
set -euo pipefail

DIR="common/database/rdb/src/main/resources/db/migration"
BASE_REF="${GITHUB_BASE_REF:-main}"
BASE="origin/${BASE_REF}"
NAME_RE='^V([0-9]+)__.+\.sql$'
```

PR 이 건드린 파일은 **3-dot diff** 로 뽑는다. `${BASE}...HEAD` 는 merge-base 기준 차이라서, base 가 그동안 앞서 나갔더라도 "이 브랜치가 실제로 더한/바꾼 것" 만 깔끔하게 잡힌다. 추가(`A`)와 수정·이름변경·삭제(`MRD`)를 따로 뽑는 게 포인트다.

```bash
added="$(git diff --diff-filter=A --name-only "${BASE}...HEAD" -- "$DIR")"
touched_mrd="$(git diff --diff-filter=MRD --name-only "${BASE}...HEAD" -- "$DIR")"
```

불변식 2 는 `touched_mrd` 가 비어있지 않으면 즉시 실패시킨다. 메시지에서 "되돌리고 새 `V<다음번호>__` 로 추가하라" 고 행동까지 안내한다. base 최대 버전은 `git ls-tree -r "$BASE"` 로 base 트리의 파일명을 훑어 `NAME_RE` 로 파싱한 정수의 최댓값으로 구한다(디렉토리가 없거나 비면 0). 추가분은 같은 정규식으로 파싱하면서 (1) 파일명 규칙, (3) 추가분 내부 중복을 검사하고 최소 버전 `min_added` 를 모은다.

마지막 불변식 4 가 병렬 충돌 차단의 핵심이다.

```bash
if [ "$min_added" -le "$base_max" ]; then
  fail "추가된 마이그레이션 버전 V${min_added} 가 base 최대 버전 V${base_max} 이하입니다 (out-of-order · 병렬 채번 충돌).
→ 추가 마이그레이션을 V$((base_max + 1)) 이상으로 재채번하세요. (main 이 앞서 머지됐다면 rebase 후 재채번)"
fi
```

GitHub Actions 에는 `::error::` 어노테이션을 함께 출력해서 PR 의 Files 탭이 아니라 체크 요약에서 바로 원인이 보이게 했다.

```bash
fail() {
  echo "::error::migration-guard: $1"
  echo "❌ migration-guard 실패: $1" >&2
  exit 1
}
```

## 여기서부터가 본론: 비직관적인 설계 결정들

스크립트 로직 자체는 한나절이면 짠다. 진짜 어려운 건 이걸 **required check** 로 박았을 때 CI·머지 정책과 맞물리는 부분이다. 아래 결정들이 빠지면 가드는 동작은 하되 팀을 마비시키거나, 조용히 사고를 통과시킨다.

### paths 필터를 일부러 두지 않는다

직관적으로는 "마이그레이션 디렉토리가 바뀐 PR 에서만 돌리자" 며 워크플로에 `paths:` 필터를 걸고 싶다. 하지만 이 체크가 **required status check** 일 때 함정이 있다. paths 로 skip 된 워크플로는 GitHub 입장에서 "성공" 이 아니라 **"pending"** 으로 남는다. 그러면 마이그레이션을 건드리지 않은 **모든 PR** 이 영원히 "필수 체크 대기 중" 상태로 머지 불가가 된다.

그래서 워크플로에는 paths 필터를 두지 않고, 대신 **모든 PR 에서 실행하되 변경이 없으면 스크립트가 early-exit 로 통과**시킨다. 이 의도는 워크플로에 주석으로 박아뒀다.

```yaml
# 주의: paths 필터를 두지 않는다. required status check 가 paths 로 skip 되면 GitHub 이
# "pending" 으로 간주해 마이그레이션을 안 건드린 모든 PR 이 머지 불가가 된다 (R1).
# 대신 모든 PR 에서 실행하고, 변경이 없으면 스크립트가 통과(early-exit)한다.
```

스크립트 쪽 early-exit 는 이렇게 생겼다.

```bash
# --- 추가된 마이그레이션이 없으면 통과 (early-exit — required check 안전) ---
if [ -z "$added" ]; then
  pass "추가된 마이그레이션 없음 (no-op)"
fi
```

정리하면, **early-exit 가 required check 의 안전장치**다. "안 건드린 PR 은 빠르게 green" 이 보장돼야 이 체크를 전 PR 필수로 걸 수 있다.

### `.sql` 확장자로 사전 필터하지 않는다 (fail-open 회피)

또 하나 직관에 반하는 선택. diff 를 뽑을 때 `-- '*.sql'` 로 미리 거르고 싶어진다. 그런데 그러면 검사망에 구멍이 생긴다.

- `V42__x.SQL` (대문자 확장자), `V42__x.sqll` (오타) 같은 파일은 `.sql` 필터를 빠져나간다.
- Flyway 는 소문자 `.sql` 만 인식하므로 이런 파일을 **조용히 무시**한다.
- 결과는 "마이그레이션을 추가했는데 실제로는 안 도는" 사고 — 전형적인 **fail-open**.
- 확장자 대소문자만 바꾼 rename 도 `MRD` 검사를 우회한다.

그래서 사전 필터 대신 **`db/migration` 의 변경 파일을 전부 검사 대상으로 잡고**, 규칙 위반은 본문에서 `NAME_RE` 로 잡아 **fail-closed** 시킨다. 규칙에 안 맞는 파일명이 디렉토리에 들어오면 그 자리에서 실패한다.

```bash
# 확장자(.sql)로 사전 필터하지 않는다. db/migration 은 마이그레이션 전용 디렉토리이므로
# 추가/변경된 "모든" 파일을 검사 대상으로 삼고, 규칙 검증은 아래 NAME_RE 로 본문에서 한다.
```

"의심스러우면 통과" 가 아니라 "의심스러우면 막는다" 로 기본값을 뒤집은 것이다. 마이그레이션처럼 사고 비용이 비싼 영역에서는 fail-closed 가 맞다.

### strict ruleset 과의 조합이 있어야 비로소 충돌이 막힌다

여기가 가장 자주 오해되는 부분이다. **정적 가드만으로는 병렬 충돌을 완전히 막지 못한다.** 다시 두 PR 시나리오를 보자.

- base 최대 버전이 `V6` 일 때, PR-A 와 PR-B 가 각각 `V7` 을 추가한다. 분기 시점 기준으로는 **둘 다 검사를 통과**한다 (둘 다 `V7 > V6`).
- PR-A 가 먼저 머지되면 `main` 최대 버전이 `V7` 로 오른다.
- 이때 PR-B 가 그대로 머지되면 충돌이다. 이걸 막는 건 GitHub ruleset 의 **strict 모드("require branches to be up to date before merging")** 다.
- strict 가 켜져 있으면 PR-B 는 머지 전에 `main` 으로 **rebase/update** 를 강제당한다. rebase 하면 base 최대 버전이 `V7` 로 갱신되고, **재검사에서 `V7 <= V7` 로 불변식 4 가 비로소 실패**한다. 개발자는 `V8` 로 재채번하게 된다.

즉 **"가드 스크립트 + ruleset strict"** 두 개가 함께여야 병렬 채번 충돌 차단이 성립한다. 스크립트 헤더에도 이 의존을 명시해뒀다.

```bash
# 병렬 충돌 차단은 ruleset 의 strict("require up to date") 정책과 함께 성립한다 —
# 먼저 머지된 쪽이 base 최대 버전을 올리면, 뒤 PR 은 rebase 후 재검사에서 충돌이 드러난다.
```

### fetch-depth: 0 — 3-dot diff 가 merge-base 를 필요로 한다

CI 의 PR 빌드는 보통 merge ref 를 얕은(shallow) 체크아웃으로 받는다. 그런데 `${BASE}...HEAD` 3-dot diff 는 두 갈래의 **merge-base** 를 계산할 수 있어야 한다. 히스토리가 잘려 있으면 merge-base 를 못 찾아 비교가 어긋난다. 그래서 체크아웃을 full-depth 로 받는다.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # 3-dot diff 의 merge-base 확보 (R3)
```

스크립트도 base 브랜치를 명시적으로 `git fetch --no-tags --quiet origin "$BASE_REF"` 한다. PR merge ref 체크아웃 환경에서 `origin/main` 이 로컬에 없을 수 있기 때문이다. 이 fetch 가 실패하면 비교 자체가 불가능하므로 통과시키지 않고 실패시킨다 — 여기서도 fail-closed 원칙이 일관된다.

워크플로 트리거와 동시성 설정은 단순하다. `pull_request` 의 `opened / synchronize / reopened` 에서 돌고, 같은 PR 의 이전 실행은 `cancel-in-progress` 로 취소한다.

```yaml
on:
  pull_request:
    branches: [ main ]
    types: [ opened, synchronize, reopened ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## 마무리

이 작업의 산출물은 "셸 스크립트 하나" 처럼 보이지만, 실제로 설계한 것은 **세 가지 정책의 맞물림**이다.

- **fail-open vs fail-closed** — 확장자 사전 필터를 버리고 전 파일을 검사해 사고를 안쪽에서 막는다.
- **required check 의 함정** — paths 필터 대신 early-exit 로, 마이그레이션을 안 건드린 PR 까지 막지 않으면서 전 PR 필수 체크를 성립시킨다.
- **GitHub 머지 정책(strict ruleset)** — 정적 가드가 잡지 못하는 "분기 시점엔 둘 다 통과" 케이스를 rebase 강제로 끌어내 재검사에서 드러낸다.

마이그레이션 가드는 도구 하나를 켜는 일이 아니라, 도구가 강제해주지 않는 전제를 CI·머지 정책 위에서 **사람 대신 지켜주는 시스템**을 짜는 일이다.

다음 단계인 Class B — Testcontainers 로 실제 PostgreSQL 에 마이그레이션을 적용해 SQL 문법·스키마 정합까지 검증하는 동적 가드 — 는 이 글의 범위 밖이며 후속으로 다룬다. 이 글은 파일을 실행하지 않고 diff 만으로 잡는 **정적 가드(Class A)** 까지다.
