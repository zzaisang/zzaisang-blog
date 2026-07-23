---
title: "Hibernate 가 만든 enum CHECK 제약을 전부 버리고, CI 로 재발을 막았다"
description: "enum 값 하나 추가에 마이그레이션을 강제하는 DB-level CHECK 제약을 걷어내고, ddl-auto=validate 의 사각지대를 CI 정적 가드로 메운 결정을 정리합니다."
pubDate: "2026-07-23T17:52:00+09:00"
category: "Database"
tags: ["postgres", "flyway", "hibernate", "ci", "migration"]
---

Hibernate 로 스키마를 부트스트랩해 본 사람은 익숙할 것이다. 엔티티에 `@Enumerated(EnumType.STRING)` 필드를 두고 `hbm2ddl` 로 DDL 을 뽑으면, Hibernate 는 친절하게도 이런 CHECK 제약을 자동으로 붙여준다.

```sql
alter table orders
    add constraint orders_status_check
    check (status in ('PENDING', 'PAID', 'SHIPPED', 'DONE'));
```

"DB 레벨에서 잘못된 값이 못 들어오게 막아준다"— 좋아 보인다. 그런데 이 자동 생성 CHECK 제약이 **스키마 진화를 은근히 경직시키는** 원인이 된다. 이 글은 이미 운영 DB 에 박혀 있던 자동 생성 enum CHECK 제약 수십 개를 걷어내기로 한 결정, 그리고 그 결정을 **CI 정적 가드로 강제**해 재발을 막은 과정을 정리한다.

## 문제: enum 값 하나 추가하는 데 마이그레이션이 강제된다

`OrderStatus` enum 에 `REFUNDED` 값 하나를 추가한다고 하자. 애플리케이션 코드에서는 enum 상수 하나 늘리면 끝이다. 그런데 DB 에 `orders_status_check` 제약이 걸려 있으면, 새 값을 쓰는 순간 제약 위반으로 INSERT/UPDATE 가 거부된다. 그래서 **enum 값을 늘릴 때마다** 다음 같은 마이그레이션을 짝으로 짜야 한다.

```sql
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
    check (status in ('PENDING', 'PAID', 'SHIPPED', 'DONE', 'REFUNDED'));
```

문제가 겹겹이다.

- **값 정의가 두 곳에 산다.** enum 은 애플리케이션 코드에, 허용값 목록은 DB 제약에. 둘이 어긋나면 런타임에 터진다.
- **순수 애플리케이션 변경이 스키마 변경으로 번진다.** enum 값 추가는 원래 코드 한 줄인데, 마이그레이션·리뷰·배포 순서까지 끌고 온다.
- **자동 생성 제약명이 환경마다 미묘하게 다를 수 있어**, drop 문을 쓸 때 실제 이름을 DB 에서 대조해야 하는 번거로움이 붙는다.

값·상태 제약은 이미 도메인 레이어에서 강제되고 있었다(enum 타입 자체가 파싱 단계에서 걸러낸다). DB CHECK 는 같은 규칙을 **중복으로, 그러나 더 경직된 형태로** 들고 있던 셈이다. 그래서 방침을 정했다: **값·상태 제약은 애플리케이션(도메인) 레이어가 단일 소스로 강제하고, 스키마에는 CHECK 를 두지 않는다.**

## 1단계: 이미 박혀 있는 CHECK 제약을 전부 제거한다

baseline 마이그레이션이 만들어 둔 자동 생성 enum CHECK 가 수십 개(수십 개 테이블에 걸쳐) 운영/개발 DB 에 이미 적용돼 있었다. 이걸 forward 마이그레이션 한 벌로 정리했다.

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

몇 가지 규율이 있었다.

- **제약명은 실제 Postgres 에 마이그레이션을 적용해 `pg_constraint` 로 대조·확정했다.** 자동 생성 이름을 추측하지 않고 실물에서 뽑았다.
- **`drop constraint if exists` 로 환경 간 멱등하게** 적용된다. 이미 없는 환경에서도 안전하다.
- **CHECK 제거는 "허용값 확대 = 후방호환"이라 롤링 배포에 안전하다.** 구버전 인스턴스가 아직 도는 중에 제약이 먼저 사라져도, 구버전은 원래 허용하던 값만 쓰므로 문제가 없다. (반대로 CHECK 를 *추가*하는 변경은 이 성질이 없어 훨씬 조심스럽다.)
- **baseline 마이그레이션은 건드리지 않았다.** 이미 적용된 과거 마이그레이션을 수정하면 Flyway 체크섬이 깨진다([운영 DB에 Flyway 처음 도입하기](../flyway-production-introduction/)에서 다룬 불변 원칙이다). CHECK 를 "만든 곳을 고치는" 대신 "뒤에서 걷어내는" forward-only 로 처리한 이유다.

## 2단계: ddl-auto=validate 의 사각지대 → CI 정적 가드

여기가 이 작업에서 가장 배울 게 많았던 지점이다. "제약을 다 지웠으니 됐다"가 아니라, **앞으로 아무도 다시 CHECK 제약을 추가하지 못하게** 막아야 정책이 산다. 그런데 우리가 기대던 안전망에 구멍이 있었다.

Hibernate `ddl-auto=validate` 는 부팅 시 엔티티와 실제 스키마의 정합을 검사한다. 하지만 **`validate` 는 CHECK 제약을 검사 대상에 넣지 않는다.** 컬럼·타입·존재 여부는 보지만, 누군가 마이그레이션에 CHECK 를 새로 넣어도 `validate` 는 조용히 통과시킨다. 즉 우리가 세운 "CHECK 없음" 방침을 실제로 강제하는 지점이 **아무 데도 없었다.**

그래서 강제 지점을 CI 정적 검사로 새로 만들었다([병렬 브랜치 마이그레이션 버전 충돌을 CI로 막기](../flyway-migration-version-ci-guard/)에서 쓴 가드와 같은 계열이다). 핵심 아이디어는 단순하다 — **이 PR 이 새로 추가한 마이그레이션 파일에 `check (` 패턴이 있으면 실패시킨다.**

```bash
# 이 PR 이 "추가한" 마이그레이션만 검사 (3-dot diff, merge-base 기준)
added="$(git diff --diff-filter=A --name-only "origin/${BASE_REF}...HEAD" -- "$MIGRATION_DIR")"

# 추가된 마이그레이션이 없으면 통과 (required check 안전을 위한 early-exit)
[ -z "$added" ] && exit 0

# check 뒤 (공백 허용) 여는 괄호 — inline·table-level CHECK 를 잡고 `_check` 제약명은 제외
CHECK_RE='check[[:space:]]*\('
grep -inHE "$CHECK_RE" $added && exit 1 || exit 0
```

설계에서 신경 쓴 결정들:

- **추가분(`--diff-filter=A`)만 본다.** 과거 baseline 에는 이미 지워진 CHECK 를 만들던 문장이 남아 있다(불변 히스토리라 수정 불가). 전체 스캔을 하면 그 죽은 문장에 오탐이 난다. 그래서 "이 PR 이 새로 추가한 파일"만 검사 대상으로 좁힌다.
- **3-dot diff(`merge-base...HEAD`)** 로 base 브랜치 대비 실제 추가분만 잡는다. CI 의 PR merge-ref 체크아웃에서도 merge-base 를 확보하려고 base 브랜치를 명시적으로 fetch 한다.
- **마이그레이션을 안 건드린 PR 은 early-exit 로 통과.** required status check 로 걸어두려면, 무관한 PR 이 이 검사 때문에 멈추면 안 된다.
- **정규식은 `check (` 여는 괄호를 요구**한다. 그래야 `check (status in (...))` 같은 실제 제약은 잡고, `drop constraint ..._check`(제약명에 들어간 `check`, 뒤가 `(` 가 아님)는 오탐하지 않는다.

**알려진 한계도 남겼다.** SQL 주석이나 문자열 리터럴 안의 `check (` 는 이 정적 검사가 오탐할 수 있다. 완벽한 SQL 파서를 만드는 대신, 흔한 실수를 값싸게 잡는 선에서 멈추고 한계를 주석과 실패 메시지에 적어뒀다. 실패 시 "CHECK 를 지우고 값 제약은 도메인 레이어에서 강제하라"는 안내와, "`validate` 가 이걸 안 잡아서 이 정적 검사가 유일한 강제 지점"이라는 배경까지 메시지에 넣어, 나중에 걸린 사람이 맥락 없이 당황하지 않게 했다.

## 트레이드오프 — 정직하게

CHECK 를 지운다는 건 **DB 레벨 안전망 하나를 포기**하는 것이기도 하다. 애플리케이션을 우회해 raw SQL 로 잘못된 값을 넣으면, 이제 DB 는 막아주지 않는다. 이 결정이 성립하는 전제는 명확하다:

- 값 쓰기 경로가 **애플리케이션 하나로 수렴**한다(도메인 enum 이 단일 진입점).
- 그 대가로 얻는 것은 **enum 진화의 자유** — 값 추가가 코드 변경으로 끝나고 스키마 마이그레이션을 끌고 오지 않는다.

여러 서비스가 같은 테이블에 제각각 raw SQL 로 쓴다면 이 트레이드오프는 다르게 계산해야 한다. "CHECK 제약은 무조건 나쁘다"가 아니라, **우리 쓰기 토폴로지에서는 이득보다 경직 비용이 컸다**는 판단이다.

## 정리

- **Hibernate 자동 생성 enum CHECK 제약은 값 정의를 DB 와 코드로 이중화**하고, enum 값 추가마다 마이그레이션을 강제해 스키마를 경직시킨다.
- 제거는 **forward-only + `if exists` 멱등 + baseline 불변**으로. 과거 마이그레이션을 고쳐 체크섬을 깨지 말 것. CHECK 제거는 후방호환이라 롤링 배포에 안전하다.
- **`ddl-auto=validate` 는 CHECK 를 검사하지 않는다.** 스키마 방침을 코드/부팅 검증에 기대고 있었다면, 정확히 그 사각지대를 확인하라.
- 방침은 **강제 지점이 있어야 산다.** 강제할 자연스러운 지점이 없으면 **CI 정적 가드**로 만든다. 단, 추가분만·early-exit·오탐 최소화·명확한 실패 메시지까지가 한 세트다.
- 그리고 무엇보다, **왜 이 제약을 포기하는지의 전제(쓰기 경로 단일화)를 명시**하라. 트레이드오프를 적어두지 않은 "베스트 프랙티스"는 다음 사람에게 지뢰가 된다.
