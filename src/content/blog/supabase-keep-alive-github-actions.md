---
title: "Supabase 무료 플랜 자동 휴면을 GitHub Actions로 막기"
description: "무료 플랜 Supabase가 7일 무활동 시 자동 휴면되는 것을 GitHub Actions 크론으로 REST 엔드포인트를 주기적으로 찔러 막는 방법을 정리합니다."
pubDate: "2026-07-23T18:40:13+09:00"
category: "DevOps"
tags: ["supabase", "github-actions", "cron", "keep-alive", "postgres"]
---

무료 플랜으로 굴리던 사이드 프로젝트가 며칠 손을 놓았더니 어느 날 갑자기 API가 전부 죽어 있었다. 코드도 안 건드렸고 결제도 멀쩡한데 DB·Auth·REST가 통째로 멈춘다. 원인은 대부분 하나다 — Supabase 무료 플랜의 7일 무활동 자동 휴면(pause). 이 글은 왜 이게 일어나는지, 그리고 GitHub Actions 크론 몇 줄로 어떻게 막는지를 실제 적용 경험을 바탕으로 정리한다.

## 왜 휴면되는가

Supabase 무료 플랜은 7일 연속으로 요청·활동이 없으면 프로젝트를 pause 시킨다. pause되면 Postgres·PostgREST·Auth가 모두 내려가고, 대시보드에서 수동으로 "Restore"를 눌러야 다시 살아난다. 실사용 트래픽이 꾸준한 운영 단계라면 겪을 일이 없지만, 개발 초기·데모용·저트래픽 사이드 프로젝트는 정확히 이 함정에 빠진다.

핵심은 이게 버그가 아니라 정책이라는 점이다. 그러니 대응도 간단하다. 7일이 지나기 전에 "이 프로젝트에 요청이 도달했다"는 사실만 주기적으로 만들어 주면 휴면 타이머가 리셋된다. 데이터를 실제로 읽어올 필요조차 없다.

## 동작 원리

전체 그림은 이렇게 단순하다.

```text
GitHub Actions (cron, 2일마다)
        │  curl GET  {SUPABASE_URL}/rest/v1/{table}?select=id&limit=1
        │            헤더: apikey + Authorization(Bearer anon key)
        ▼
   Supabase REST (PostgREST)
        └─▶ 요청이 "활동"으로 집계 → 7일 휴면 타이머 리셋
```

여기서 중요한 건 두 가지다. 하나, 응답이 2xx/3xx면 성공이다. RLS(Row Level Security)에 막혀 빈 배열 `[]`이 돌아와도 상태 코드는 200이라 활동으로 집계된다. 둘, 목적은 데이터가 아니라 "요청 도달" 자체다. 그래서 가장 가벼운 쿼리(`select=id&limit=1`) 하나면 충분하다.

## 어떤 걸 조회할까 — 세 가지 옵션

요청을 한 번 보내려면 "무엇을 조회할지"를 정해야 한다. 선택지는 셋이고 트레이드오프가 갈린다.

**옵션 A — 기존 테이블 조회 (가장 간단, 권장).** anon 역할이 `SELECT` 권한을 가진 아무 테이블이나 하나 고른다. RLS가 걸려 있어도 200 + 빈 배열이면 정상이다. 단, anon에게 `SELECT` GRANT조차 없으면 `permission denied`가 날 수 있다.

**옵션 B — 전용 keep-alive 테이블 (가장 견고).** 기존 테이블의 권한·RLS 변경에 흔들리지 않도록 빈 테이블을 하나 판다. 프로젝트마다 테이블명만 통일해 두면 워크플로우를 그대로 복붙할 수 있다.

```sql
create table if not exists public.keep_alive (
  id smallint primary key
);

alter table public.keep_alive enable row level security;

create policy "anon can select keep_alive"
  on public.keep_alive
  for select
  to anon
  using (true);
```

**옵션 C — 테이블 없이 Auth health 엔드포인트.** `GET {SUPABASE_URL}/auth/v1/health`를 때린다. 테이블·권한을 신경 안 써도 되지만, 이건 DB(PostgREST)가 아니라 Auth(GoTrue) 요청이라 DB 활동 기준으로 pause를 판단하는 경우 효과가 불확실하다. 폴백으로만 쓰는 게 안전하다.

실제 적용에선 옵션 A를 택했다. 이미 "도서는 누구나 조회"류의 공개 SSR 데이터를 담은 테이블이 있었고, 그 테이블엔 `anon`에게 `select`을 허용하는 RLS 정책과 `id`(bigint PK)가 이미 있었다. 마이그레이션 없이 조회 대상 한 줄만 지정하면 끝이었다는 얘기다. 공개용으로 설계된 테이블이라 anon-select 정책이 사라질 일도 없어, 옵션 B의 견고함이 주는 실익이 적었다.

## 워크플로우 작성

`.github/workflows/supabase-keep-alive.yml` 하나면 된다. `KEEP_ALIVE_TABLE` 한 곳만 자기 프로젝트 테이블로 바꾸면 어디에나 붙는다.

```yaml
name: Supabase Keep-Alive

# 무료 플랜 Supabase는 7일 무활동 시 자동 휴면된다.
# 2일마다 REST 엔드포인트에 가벼운 요청을 보내 활동 상태를 유지한다.

on:
  schedule:
    - cron: "0 6 */2 * *"   # 매 2일 06:00 UTC
  workflow_dispatch: {}      # 수동 실행 허용

env:
  KEEP_ALIVE_TABLE: books    # anon 이 SELECT 가능한 테이블명

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST endpoint
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
            echo "::error::SUPABASE_URL / SUPABASE_ANON_KEY 시크릿이 없습니다."
            exit 1
          fi

          url_trimmed="${SUPABASE_URL%/}"   # 끝 슬래시 제거(이중 슬래시 방지)

          response=$(curl -s -w "\n%{http_code}" \
            -H "apikey: ${SUPABASE_ANON_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
            "${url_trimmed}/rest/v1/${KEEP_ALIVE_TABLE}?select=id&limit=1")

          status=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "HTTP status: ${status}"
          echo "응답 본문: ${body}"

          # 2xx/3xx 면 활동으로 집계되어 휴면이 리셋된다.
          if [ "$status" -lt 200 ] || [ "$status" -ge 400 ]; then
            echo "::error::예상치 못한 응답 코드(${status}). 응답 본문의 message/hint를 확인하세요."
            exit 1
          fi

          echo "Keep-alive ping 성공 — 프로젝트 활동 상태 갱신됨."
```

GitHub Actions 워크플로를 이런 자동 가드로 쓰는 패턴은 [병렬 브랜치 마이그레이션 버전 충돌을 CI로 막기](../flyway-migration-version-ci-guard/)에서도 다뤘다. 거긴 `pull_request` 트리거, 여긴 `schedule` 크론이라는 차이만 있고, "도구가 알아서 안 해주는 걸 워크플로로 대신 챙긴다"는 결은 같다.

`SUPABASE_URL`과 `SUPABASE_ANON_KEY`는 저장소의 Settings → Secrets and variables → Actions에 등록한다. URL은 `https://xxxx.supabase.co`(대시보드 → Project Settings → Data API), 키는 anon(public) 키를 넣는다.

시크릿 값 자체는 GitHub가 로그에서 자동으로 마스킹하므로, 디버깅이 필요하면 값이 아니라 파생 정보(키 길이, `eyJ` 접두사 여부, 상태 코드)만 찍어 진단하는 걸 추천한다.

## 시크릿 등록과 검증

주의할 함정이 하나 있다. GitHub 크론은 워크플로우 파일이 기본 브랜치(main)에 올라가 있어야 돈다. 그리고 파일을 처음 올린 직후엔 스케줄이 바로 트리거되지 않는다. 그래서 최초 1회는 반드시 수동으로 돌려 검증한다.

- 저장소 → Actions 탭 → Supabase Keep-Alive → Run workflow
- 로그에서 `HTTP status: 200`과 `Keep-alive ping 성공`이 보이면 완료.

혹시 실패하면 응답 본문의 message로 원인을 좁힐 수 있다.

| 응답 message | 원인 | 해결 |
|---|---|---|
| `No API key found in request` | 시크릿이 비었거나 헤더 전달 실패 | 시크릿 재확인 |
| `Invalid API key` | 키에 공백·줄바꿈 혼입 또는 다른 프로젝트 키 | 키 다시 복사해 재등록 |
| `JWT expired` | 만료된 키 | 대시보드의 현재 anon 키로 갱신 |
| `relation "xxx" does not exist` | 테이블명 오타 | 실제 테이블명으로 수정 |
| `permission denied for table xxx` | anon에 SELECT 권한 없음 | 옵션 B 전용 테이블 사용 |

## 주의점

- **service_role 키는 절대 쓰지 않는다.** keep-alive엔 anon(public) 키만 쓴다. anon 키는 어차피 클라이언트에 노출되는 공개 키라 CI에 넣어도 안전하지만, service_role은 RLS를 우회하는 관리자 키라 CI 시크릿으로도 넣으면 안 된다.
- 크론은 정시에 안 온다. GitHub Actions 스케줄은 부하에 따라 수십 분에서 수 시간까지 밀린다. 그래서 7일 한도에 여유가 큰 2일 주기를 쓴다. 불안하면 1일 주기로 더 보수적으로 잡아도 된다.
- 60일 규칙. 저장소에 60일간 커밋 활동이 없으면 GitHub가 스케줄 워크플로우를 자동 비활성화한다. 활발히 개발 중이면 무관하지만, 장기 방치하면 재활성화가 필요하다.
- 이건 근본 해결이 아니다. 실사용 트래픽이 생기면 이 워크플로우는 지워도 된다. 어디까지나 저활동 구간을 버티는 임시 보호장치고, 유료 플랜(Pro 이상)은 애초에 pause가 없으니 필요 없다.

정리하면, 무료 플랜의 7일 휴면은 정책이지 장애가 아니고, 대응은 "가장 싼 요청 한 번을 2일마다 자동으로 보내기"로 끝난다. 파일 하나 커밋하고 시크릿 두 개 등록한 뒤 수동으로 한 번만 돌려 200을 확인하면, 다시는 "어제까지 되던 앱이 갑자기 안 되는" 일을 겪지 않는다.
