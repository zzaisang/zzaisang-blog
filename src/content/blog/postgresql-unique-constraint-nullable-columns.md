---
title: "PostgreSQL 복합 유니크 제약 nullable 컬럼 중복 NULL 허용 검증"
description: "nullable 컬럼이 낀 복합 유니크 제약이 중복 NULL 을 허용하는지, 그 인덱스·플래너 동작까지 PostgreSQL 16 에서 직접 검증하고 문서 근거와 함께 정리합니다."
pubDate: "2026-09-17T09:12:50+09:00"
category: "Database"
tags: ["postgresql", "unique-constraint", "null", "btree-index", "partial-index"]
---

멀티테넌트 서비스의 회원 테이블에 `unique (tenant_id, phone_number, country_code)` 복합 유니크 제약이 걸려 있고, `phone_number` 는 nullable 이다. 여기에 "번호를 NULL 로 비워서 슬롯을 해제한다"는 설계를 얹으려면 먼저 하나가 분명해야 한다. **같은 테넌트에 NULL 번호 회원이 둘 이상 있어도 되는가?** 유니크 인덱스가 NULL 을 하나의 값으로 취급한다면 두 번째 NULL 부터 충돌한다.

PostgreSQL 의 답은 분명하다. 기본값인 `NULLS DISTINCT` 에서는 NULL 끼리 서로 다른 값이라, 중복 NULL 은 얼마든지 들어간다. 복합 키의 컬럼 하나만 NULL 이어도 그 행은 어떤 행과도 충돌하지 않는다. 이 글은 그 동작을 PostgreSQL 16.14 에서 직접 돌려 확인하고, 매 지점마다 공식 문서 근거를 붙였다.

## 검증 환경

```bash
docker run --rm -d -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
```

```text
PostgreSQL 16.14 on aarch64-unknown-linux-musl
```

회원 테이블을 단순화한 스키마다. 전화번호·국가코드가 nullable 이고, 테넌트 단위 복합 유니크 제약이 걸려 있다. 이후 모든 검증이 이 테이블을 쓴다.

```sql
create table members (
  id int primary key,
  tenant_id varchar(255),
  phone_number varchar(255),
  country_code varchar(255),
  status varchar(16) not null default 'ACTIVE',
  constraint uk_members_tenant_phone
    unique (tenant_id, phone_number, country_code)
);
```

## NULL 은 중복이 허용된다

핵심 질문부터 확인한다. 같은 테넌트에 NULL 번호를 세 건 넣어 봤다.

```sql
insert into members(id,tenant_id,phone_number,country_code)
values (1,'T1',null,null),(2,'T1',null,null),(3,'T1',null,null);

select count(*) from members where tenant_id='T1' and phone_number is null;
```

```text
INSERT 0 3
 null_phone_rows_in_t1
-----------------------
                     3
```

세 건 모두 통과한다. NULL 은 개수 제한이 없다. 문서(DDL Constraints §5.5.3)가 그대로 보증하는 동작이다.

> By default, two null values are not considered equal in this comparison. That means even in the presence of a unique constraint it is possible to store duplicate rows that contain a null value in at least one of the constrained columns.

반면 값이 있는 행의 중복은 당연히 막힌다.

```text
INSERT 0 1
ERROR:  duplicate key value violates unique constraint "uk_members_tenant_phone"
DETAIL:  Key (tenant_id, phone_number, country_code)=(T1, 01012345678, KR) already exists.
```

## 함정: 컬럼 하나만 NULL 이어도 중복이 아니다

문서는 복합 유니크의 판정 조건을 이렇게 못 박는다.

> A multicolumn unique index will only reject cases where all indexed columns are equal in multiple rows.

"모든 컬럼이 같을 때만" 거부한다는 뜻이다. 번호는 같고 국가코드만 NULL 인 행 두 개를 넣어 확인했다.

```sql
insert into members(id,tenant_id,phone_number,country_code)
values (6,'T1','01099990000',null),(7,'T1','01099990000',null);
```

```text
INSERT 0 2
 id | phone_number | country_code
----+--------------+--------------
  6 | 01099990000  |
  7 | 01099990000  |
```

둘 다 통과한다. 여기가 함정이다. 컬럼 하나라도 NULL 이면 나머지가 전부 같아도 중복으로 보지 않는다. 번호는 있는데 국가코드만 빠진 행이 생길 수 있는 스키마라면, 유니크 제약이 그 행들을 지켜 주지 않는다. 두 컬럼을 항상 함께 세팅하거나(임베디드 값 객체로 묶는 식), `country_code` 에 NOT NULL 또는 CHECK 를 둬서 짝을 강제해야 한다.

## 값을 비우면 유니크 슬롯이 풀린다

앞의 두 성질을 합치면 실용적인 관용구가 나온다. "비활성 회원의 번호를 NULL 로 초기화해, 그 번호를 다른 계정이 다시 쓰게 한다"는 시나리오다.

```sql
update members set phone_number=null, country_code=null, status='INACTIVE' where id=4;
insert into members(id,tenant_id,phone_number,country_code)
values (8,'T1','01012345678','KR');
```

```text
UPDATE 1
INSERT 0 1
 id |  status  | phone_number | country_code
----+----------+--------------+--------------
  4 | INACTIVE |              |
  8 | ACTIVE   | 01012345678  | KR
```

4번이 쓰던 번호를 8번이 그대로 넘겨받았다. 제약을 건드리지 않고도 "유니크 키 해제" 가 된다. 이 관용구는 앞서 확인한 "NULL 은 중복 허용" 이 성립해야 쓸 수 있고, 실제로 성립한다.

## 제약이 곧 인덱스다

여기서부터는 이 동작이 내부적으로 무엇에 얹혀 있는지 본다. 유니크 제약을 걸면 같은 이름의 유니크 B-tree 인덱스가 자동으로 생긴다.

```sql
select indexname, indexdef from pg_indexes where tablename='members';
```

```text
 members_pkey            | CREATE UNIQUE INDEX members_pkey ON public.members USING btree (id)
 uk_members_tenant_phone | CREATE UNIQUE INDEX uk_members_tenant_phone ON public.members USING btree (tenant_id, phone_number, country_code)
```

이 인덱스가 제약을 강제하는 실체다. 그래서 중복 검사용 `exists` 쿼리를 위해 인덱스를 따로 만들 필요가 없다. 문서도 같은 말을 한다.

> PostgreSQL automatically creates a unique index when a unique constraint or primary key is defined for a table. (...) There's no need to manually create indexes on unique columns; doing so would just duplicate the automatically-created index.

## NULL 행은 인덱스에 얼마나 부담인가

"NULL 행이 많아지면 인덱스가 커지나, 삽입이 느려지나"를 측정했다. NULL 1만 건과 non-NULL 1만 건을 순서대로 넣었다.

```sql
select pg_size_pretty(pg_relation_size('uk_members_tenant_phone'));  -- before
\timing on
insert into members(...) select g, 'T1', null, null from generate_series(100, 10099) g;
insert into members(...) select g, 'T1', '010'||lpad(g::text,8,'0'), 'KR' from generate_series(20000, 29999) g;
\timing off
select pg_size_pretty(pg_relation_size('uk_members_tenant_phone'));  -- after
```

```text
 idx_size_before: 16 kB
INSERT 0 10000   Time: 18.193 ms   -- NULL 1만 건
INSERT 0 10000   Time: 27.015 ms   -- non-NULL 1만 건
 idx_size_after: 784 kB
 null_rows | total_rows
     10004 |      20007
```

두 가지가 드러난다. B-tree 는 NULL 도 엔트리로 저장하므로, 인덱스는 행 수에 비례해 커지고 NULL 이라고 빠지지 않는다. 대신 삽입 비용은 NULL 쪽이 오히려 낮다. NULL 은 유일성 비교 대상이 아니라 충돌 검사가 사실상 없기 때문이다. (1만 건 단위 한 번 측정이니, 절대값보다 "NULL 이 더 비싸지지는 않는다"는 방향만 읽으면 된다.)

## 플래너는 이 인덱스를 어떻게 쓰나

애플리케이션이 중복 검사에 쓰는 `exists` 형태의 쿼리는 이 유니크 인덱스를 그대로 탄다.

```sql
explain (analyze, costs off, timing off, summary off)
select count(*) > 0 from members
where tenant_id='T1' and phone_number='01012345678' and country_code='KR';
```

```text
 Aggregate (actual rows=1 loops=1)
   ->  Index Only Scan using uk_members_tenant_phone on members (actual rows=1 loops=1)
         Index Cond: ((tenant_id = 'T1'::text) AND (phone_number = '01012345678'::text) AND (country_code = 'KR'::text))
```

`IS NULL` 은 값의 선택도에 따라 갈린다. 전체 행의 절반이 NULL 인 흔한 값을 찾으면 플래너는 인덱스를 버리고 시퀀셜 스캔을 택한다.

```text
 ->  Seq Scan on members (actual rows=10004 loops=1)
       Filter: ((phone_number IS NULL) AND ((tenant_id)::text = 'T1'::text))
```

이건 문서 §11.8 그대로다. "a query searching for a common value (one that accounts for more than a few percent of all the table rows) will not use the index anyway." 반대로 드문 키로 `IS NULL` 을 찾으면 같은 유니크 B-tree 가 `IS NULL` 을 Index Cond 로 받아 처리한다.

```text
 ->  Index Only Scan using uk_members_tenant_phone on members (actual rows=0 loops=1)
       Index Cond: ((tenant_id = 'T2'::text) AND (phone_number IS NULL))
```

§11.2.1 의 "an `IS NULL` or `IS NOT NULL` condition on an index column can be used with a B-tree index" 를 눈으로 확인한 셈이다.

## 반대 동작이 필요할 때: NULLS NOT DISTINCT

지금까지의 기본 동작을 뒤집는 옵션이 PostgreSQL 15 부터 있다. 같은 스키마에 `NULLS NOT DISTINCT` 만 붙이면 두 번째 NULL 행이 거부된다.

```sql
constraint uk_nnd unique nulls not distinct (tenant_id, phone_number, country_code)
```

```text
INSERT 0 1
ERROR:  duplicate key value violates unique constraint "uk_nnd"
DETAIL:  Key (tenant_id, phone_number, country_code)=(T1, null, null) already exists.
```

"NULL 초기화로 슬롯 해제" 설계를 쓰는 테이블에는 이 옵션을 절대 붙이면 안 된다. 둘은 양립하지 않는다. 반대로 "미입력 값도 테넌트당 하나만" 이 요구라면 이게 정답이다.

단, 버전 경계가 있다. 기본 동작(`NULLS DISTINCT`)은 14 에서도 같아서, PostgreSQL 14.24 컨테이너에서 위 검증들을 반복해 동일 결과를 확인했다. 달라지는 건 문법뿐이다. `UNIQUE NULLS [NOT] DISTINCT` 절 자체가 15 에서 추가돼, 14 에서는 `syntax error at or near "nulls"` 로 실패한다. 15 릴리스 노트도 "Previously NULL entries were always treated as distinct values, but this can now be changed by creating constraints and indexes using UNIQUE NULLS NOT DISTINCT." 라고 적는다. dev 와 prod 의 메이저 버전이 다르면 마이그레이션은 낮은 쪽 문법으로 써야 한다.

## 정리

- nullable 컬럼이 낀 복합 유니크 제약에서 NULL 은 중복이 무제한 허용되고, 값을 NULL 로 바꾸면 슬롯이 풀린다. PostgreSQL 이 정의한 기본 동작이며 문서도 이를 말리지 않는다.
- 복합 키의 일부 컬럼만 NULL 인 행은 제약 밖이다. 값 객체로 함께 세팅하거나 NOT NULL/CHECK 로 짝을 강제한다.
- 성능 목적으로 손댈 이유는 거의 없다. 제약이 만든 인덱스가 중복 검사 쿼리를 그대로 서비스한다. NULL 행이 테이블의 상당 비율이고 인덱스 크기가 문제될 규모일 때만, 문서가 권하는 `where phone_number is not null` partial index 를 검토한다. 작은 테이블에서는 얻는 게 없다.
- `NULLS NOT DISTINCT` 는 요구가 "NULL 도 하나만" 일 때에 한한다. 슬롯 해제 관용구와는 양립하지 않는다.
- 이식성에 주의한다. SQL 표준은 이 동작을 구현 정의로 두므로, 다른 DBMS 로 옮길 가능성이 있으면 확인해야 한다(H2 는 `MODE=PostgreSQL` 에서 동일하게 NULL 을 구분한다).

## 재현 스크립트

```sql
select version();

create table members (
  id int primary key,
  tenant_id varchar(255),
  phone_number varchar(255),
  country_code varchar(255),
  status varchar(16) not null default 'ACTIVE',
  constraint uk_members_tenant_phone unique (tenant_id, phone_number, country_code)
);

-- 1. NULL 여러 건
insert into members(id,tenant_id,phone_number,country_code)
values (1,'T1',null,null),(2,'T1',null,null),(3,'T1',null,null);
select count(*) from members where tenant_id='T1' and phone_number is null;

-- 2. non-NULL 중복 거부
insert into members(id,tenant_id,phone_number,country_code) values (4,'T1','01012345678','KR');
insert into members(id,tenant_id,phone_number,country_code) values (5,'T1','01012345678','KR');

-- 3. 컬럼 하나만 NULL
insert into members(id,tenant_id,phone_number,country_code)
values (6,'T1','01099990000',null),(7,'T1','01099990000',null);

-- 4. 슬롯 해제
update members set phone_number=null, country_code=null, status='INACTIVE' where id=4;
insert into members(id,tenant_id,phone_number,country_code) values (8,'T1','01012345678','KR');

-- 5. 제약 = 인덱스
select indexname, indexdef from pg_indexes where tablename='members';

-- 6. 크기·삽입 비용
select pg_size_pretty(pg_relation_size('uk_members_tenant_phone'));
\timing on
insert into members(id,tenant_id,phone_number,country_code)
select g, 'T1', null, null from generate_series(100, 10099) g;
insert into members(id,tenant_id,phone_number,country_code)
select g, 'T1', '010'||lpad(g::text,8,'0'), 'KR' from generate_series(20000, 29999) g;
\timing off
select pg_size_pretty(pg_relation_size('uk_members_tenant_phone'));

-- 7. 플래너
analyze members;
explain (analyze, costs off, timing off, summary off)
select count(*) > 0 from members where tenant_id='T1' and phone_number='01012345678' and country_code='KR';
explain (analyze, costs off, timing off, summary off)
select count(*) from members where tenant_id='T1' and phone_number is null;
explain (analyze, costs off, timing off, summary off)
select count(*) from members where tenant_id='T2' and phone_number is null;

-- 8. NULLS NOT DISTINCT 대조 (PG15+)
create table members_nnd (
  id int primary key,
  tenant_id varchar(255),
  phone_number varchar(255),
  country_code varchar(255),
  constraint uk_nnd unique nulls not distinct (tenant_id, phone_number, country_code)
);
insert into members_nnd values (1,'T1',null,null);
insert into members_nnd values (2,'T1',null,null);
```
