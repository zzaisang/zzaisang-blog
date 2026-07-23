---
title: "Hibernate 가 만든 enum CHECK 제약을 전부 버리고, CI 로 재발을 막았다"
description: "enum 값 하나 추가에 마이그레이션을 강제하는 DB-level CHECK 제약을 걷어내고, ddl-auto=validate 의 사각지대를 CI 정적 가드로 메운 결정을 정리합니다."
pubDate: "2026-07-23T17:52:00+09:00"
category: "Database"
tags: ["postgres", "flyway", "hibernate", "ci", "migration"]
---

Hibernate 로 스키마를 부트스트랩해 본 사람은 익숙할 것이다. 엔티티에 `@Enumerated(EnumType.STRING)` 필드를 두고 `hbm2ddl` 로 DDL 을 뽑으면, Hibernate 가 이런 CHECK 제약을 알아서 붙여준다.

```sql
alter table orders
    add constraint orders_status_check
    check (status in ('PENDING', 'PAID', 'SHIPPED', 'DONE'));
```

"DB 레벨에서 잘못된 값이 못 들어오게 막아준다" — 얼핏 좋아 보인다. 그런데 이 자동 생성 CHECK 제약이 스키마를 은근히 경직시키는 원인이 된다. 이 글은 이미 운영 DB 에 박혀 있던 자동 생성 enum CHECK 제약 수십 개를 걷어내기로 한 결정, 그리고 그 결정을 CI 정적 가드로 강제해 재발을 막은 과정을 정리한 기록이다.

## 문제: enum 값 하나 추가하는 데 마이그레이션이 강제된다

`OrderStatus` enum 에 `REFUNDED` 값 하나를 추가한다고 하자. 애플리케이션 코드에서는 enum 상수 하나 늘리면 끝이다. 그런데 DB 에 `orders_status_check` 제약이 걸려 있으면, 새 값을 쓰는 순간 제약 위반으로 INSERT/UPDATE 가 거부된다. 그래서 enum 값을 늘릴 때마다 다음 같은 마이그레이션을 짝으로 짜야 한다.

```sql
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
    check (status in ('PENDING', 'PAID', 'SHIPPED', 'DONE', 'REFUNDED'));
```

불편이 겹겹이다. 우선 값 정의가 두 곳에 산다 — enum 은 애플리케이션 코드에, 허용값 목록은 DB 제약에. 둘이 어긋나면 런타임에 터진다. 코드 한 줄이면 될 enum 값 추가가 마이그레이션·리뷰·배포 순서까지 끌고 온다는 것도 문제고, 자동 생성 제약명이 환경마다 미묘하게 달라서 drop 문을 쓸 때 실제 이름을 DB 에서 대조해야 하는 번거로움도 붙는다.

값·상태 제약은 이미 도메인 레이어에서 강제되고 있었다. enum 타입 자체가 파싱 단계에서 이상한 값을 걸러낸다. DB CHECK 는 같은 규칙을 더 경직된 형태로 한 번 더 들고 있던 것뿐이었다. 그래서 방침을 정했다 — 값·상태 제약은 애플리케이션(도메인) 레이어가 단일 소스로 강제하고, 스키마에는 CHECK 를 두지 않는다.

## 1단계: 이미 박혀 있는 CHECK 제약을 전부 제거한다

baseline 마이그레이션이 만들어 둔 자동 생성 enum CHECK 가 수십 개 테이블에 걸쳐 운영·개발 DB 에 이미 적용돼 있었다. 이걸 forward 마이그레이션 한 벌로 정리했다.

```sql
-- 자동 생성 enum CHECK 제약 일괄 제거.
-- 값 관리를 애플리케이션(엔티티) 레벨로 통일하면서 DB-level CHECK 를 걷어낸다.
alter table orders
    drop constraint if exists orders_status_check;

alter table members
    drop constraint if exists members_status_check,
    drop constraint if exists members_country_code_check;
-- ... (대상 테이블 전체 반복)
```

몇 가지는 지켰다. 제약명은 추측하지 않고 실제 Postgres 에 마이그레이션을 적용해 `pg_constraint` 로 대조해서 확정했다. `drop constraint if exists` 를 써서 이미 제약이 없는 환경에서도 멱등하게 돌게 했다. CHECK 제거는 허용값을 넓히는 방향, 즉 후방호환이라 롤링 배포에 안전하다 — 구버전 인스턴스가 아직 도는 중에 제약이 먼저 사라져도, 구버전은 원래 허용하던 값만 쓰니 문제가 없다. (반대로 CHECK 를 *추가*하는 변경은 이 성질이 없어 훨씬 조심스럽다.)

baseline 마이그레이션은 건드리지 않았다. 이미 적용된 과거 마이그레이션을 수정하면 Flyway 체크섬이 깨진다. 이건 [운영 DB에 Flyway 처음 도입하기](../flyway-production-introduction/)에서 다룬 불변 원칙 그대로다. 그래서 CHECK 를 "만든 곳을 고치는" 대신 "뒤에서 걷어내는" forward-only 로 처리했다.

## 2단계: ddl-auto=validate 의 사각지대 → CI 정적 가드

이 작업에서 배울 게 제일 많았던 지점이다. 제약을 다 지웠다고 끝이 아니다. 앞으로 아무도 다시 CHECK 제약을 추가하지 못하게 막아야 이 방침이 산다. 그런데 우리가 기대던 안전망에 구멍이 있었다.

Hibernate `ddl-auto=validate` 는 부팅할 때 엔티티와 실제 스키마의 정합을 검사한다. 하지만 `validate` 는 CHECK 제약을 검사 대상에 넣지 않는다. 컬럼·타입·존재 여부는 보지만, 누군가 마이그레이션에 CHECK 를 새로 넣어도 조용히 통과시킨다. 우리가 세운 "CHECK 없음" 방침을 실제로 강제하는 지점이 아무 데도 없었던 것이다.

그래서 강제 지점을 CI 정적 검사로 새로 만들었다. [병렬 브랜치 마이그레이션 버전 충돌을 CI로 막기](../flyway-migration-version-ci-guard/)에서 쓴 가드와 같은 계열이다. 아이디어는 단순하다 — 이 PR 이 새로 추가한 마이그레이션 파일에 `check (` 패턴이 있으면 실패시킨다.

```bash
# 이 PR 이 "추가한" 마이그레이션만 검사 (3-dot diff, merge-base 기준)
added="$(git diff --diff-filter=A --name-only "origin/${BASE_REF}...HEAD" -- "$MIGRATION_DIR")"

# 추가된 마이그레이션이 없으면 통과 (required check 안전을 위한 early-exit)
[ -z "$added" ] && exit 0

# check 뒤 (공백 허용) 여는 괄호 — inline·table-level CHECK 를 잡고 `_check` 제약명은 제외
CHECK_RE='check[[:space:]]*\('
grep -inHE "$CHECK_RE" $added && exit 1 || exit 0
```

몇 가지 결정이 이 짧은 스크립트 뒤에 깔려 있다.

추가분(`--diff-filter=A`)만 본다. 과거 baseline 에는 지금은 지워진 CHECK 를 만들던 문장이 그대로 남아 있는데(불변 히스토리라 수정 불가), 전체를 스캔하면 그 죽은 문장에 오탐이 난다. 그래서 이 PR 이 새로 추가한 파일만 검사 대상으로 좁혔다. 그 추가분은 3-dot diff(`merge-base...HEAD`)로 뽑아 base 브랜치 대비 실제로 더한 것만 잡고, CI 의 PR merge-ref 체크아웃에서도 merge-base 를 확보하려고 base 브랜치를 명시적으로 fetch 한다.

마이그레이션을 안 건드린 PR 은 early-exit 로 통과시킨다. 이 검사를 required status check 로 걸어두려면, 무관한 PR 이 이것 때문에 멈추면 안 되기 때문이다(같은 함정은 앞의 CI 가드 글에서 자세히 다뤘다). 그리고 정규식이 `check (` 로 여는 괄호를 요구하게 한 건, `check (status in (...))` 같은 실제 제약은 잡으면서 `drop constraint ..._check` 처럼 제약명에 `check` 가 들어갔을 뿐 뒤가 `(` 가 아닌 경우를 오탐하지 않기 위해서다.

한계도 그대로 남겨뒀다. SQL 주석이나 문자열 리터럴 안의 `check (` 는 이 정적 검사가 오탐할 수 있다. 완벽한 SQL 파서를 만드는 대신 흔한 실수를 값싸게 잡는 선에서 멈추고, 한계는 주석과 실패 메시지에 적었다. 실패했을 때 "CHECK 를 지우고 값 제약은 도메인 레이어에서 강제하라"는 안내와 "`validate` 가 이걸 안 잡아서 이 정적 검사가 유일한 강제 지점"이라는 배경까지 메시지에 넣어, 나중에 걸린 사람이 맥락 없이 당황하지 않게 했다.

## 트레이드오프

CHECK 를 지운다는 건 DB 레벨 안전망 하나를 포기하는 것이기도 하다. 애플리케이션을 우회해 raw SQL 로 잘못된 값을 넣으면, 이제 DB 는 막아주지 않는다. 이 결정이 성립하는 전제는 하나다 — 값 쓰기 경로가 애플리케이션 하나로 수렴한다는 것(도메인 enum 이 단일 진입점이다). 그 대가로 얻는 건 enum 진화의 자유고, 값 추가가 코드 변경으로 끝나 스키마 마이그레이션을 끌고 오지 않는다.

여러 서비스가 같은 테이블에 제각각 raw SQL 로 쓰는 구조라면 이 계산은 달라진다. "CHECK 제약은 무조건 나쁘다"가 아니라, 우리 쓰기 토폴로지에서는 얻는 것보다 경직 비용이 더 컸다는 판단이다.

## 정리

Hibernate 가 자동 생성하는 enum CHECK 제약은 값 정의를 DB 와 코드로 이중화하고, enum 값을 늘릴 때마다 마이그레이션을 강제해 스키마를 경직시킨다. 제거는 forward-only 로, `if exists` 로 멱등하게, baseline 은 건드리지 않는 선에서 했다. 과거 마이그레이션을 고쳐 체크섬을 깨면 안 되고, 다행히 CHECK 제거는 후방호환이라 롤링 배포에 안전하다.

한편 `ddl-auto=validate` 는 CHECK 를 검사하지 않는다. 스키마 방침을 부팅 검증에 기대고 있었다면 정확히 그 사각지대를 먼저 확인해야 한다. 방침은 강제할 지점이 있어야 사는데, 자연스러운 지점이 없으면 CI 정적 가드로 만든다. 단 추가분만 볼 것, early-exit 로 무관한 PR 은 통과시킬 것, 오탐을 줄일 것, 실패 메시지를 친절하게 쓸 것 — 이게 한 세트다.

그리고 무엇보다, 왜 이 제약을 포기하는지의 전제(쓰기 경로 단일화)를 어딘가에 적어둬야 한다. 트레이드오프를 남기지 않은 "베스트 프랙티스"는 다음 사람에게 그냥 지뢰다.
