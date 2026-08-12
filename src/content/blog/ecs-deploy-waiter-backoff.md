---
title: "GitHub Actions ECS 배포 시간 단축하기"
description: "GitHub Actions ECS 배포 잡의 미귀속 2분을 스텝 단위로 추적해, 원인이 AWS SDK 웨이터의 지수 백오프였음을 밝히고 한 줄로 고친 과정을 정리합니다."
pubDate: "2026-08-12T11:24:35+09:00"
category: "DevOps"
tags: ["ecs", "github-actions", "aws-sdk", "cd", "waiter"]
---

CD 파이프라인의 ECS 배포 잡이 5분 30초 걸렸다. 그런데 AWS 콘솔에서 보는 배포는 그렇게 오래 걸리지 않았다. 체감과 숫자가 어긋날 때는 대개 둘 중 하나다. 체감이 틀렸거나, 숫자가 다른 걸 재고 있거나.

이번엔 후자였다. 그리고 범인은 ECS가 아니라 배포 액션이 쓰는 AWS SDK의 **폴링 백오프**였다.

## 먼저 구간을 나눠서 잰다

처음 세운 가설은 흔한 것들이었다. 타깃 그룹 헬스체크 임계치가 높아서, 혹은 ALB `deregistration_delay`가 300초라서. 둘 다 그럴듯했지만 둘 다 틀렸다. 가설로 시작하면 이렇게 된다.

그래서 가설을 버리고 구간을 나눴다. 두 개의 독립된 타임라인을 뽑아서 겹친다.

```bash
# 1. GitHub Actions 스텝별 타임스탬프
gh api "repos/<owner>/<repo>/actions/runs/$RUN/jobs" --jq '
  .jobs[] | select(.conclusion != "skipped") |
  "job \(.started_at) -> \(.completed_at)",
  (.steps[] | "  \(.number). \(.name) :: \(.started_at) -> \(.completed_at)")'

# 2. ECS 서비스 이벤트 (실제 배포가 언제 끝났는지)
aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0].events[0:10].{t:createdAt,m:message}' --output json
```

두 번째 쿼리가 뱉는 `(service ...) has reached a steady state.` 이벤트 시각이 **ECS 입장에서 배포가 끝난 순간**이다. 이걸 Actions 스텝 종료 시각과 빼면 답이 나온다.

이 차이를 **오버슛(overshoot)** 이라고 부르기로 했다.

```text
오버슛 = (Deploy 스텝 종료 시각) − (ECS "deployment completed" 이벤트 시각)
```

이 구간 동안 ECS에서는 아무 일도 일어나지 않는다. 새 태스크는 이미 떠서 트래픽을 받고 있고, 러너만 붙잡혀 있다.

## 측정 결과

8회 배포를 dev/prod 양쪽에서 뽑았다.

| run | env | Deploy 스텝 | 오버슛 |
|---|---|---|---|
| A | dev | 311s | 99.5s |
| B | dev | 301s | 100.6s |
| C | dev | 223s | 8.6s |
| D | dev | 207s | 18.1s |
| E | prod | 348s | 164.4s |
| F | prod | 330s | 127.3s |
| G | prod | 197s | 6.1s |
| H | prod | 186s | 13.3s |

여기서 세 가지가 한 번에 드러난다.

1. **`Deploy to Amazon ECS` 외 모든 스텝의 합은 10~14초**였다. checkout, ECR 로그인, task definition 다운로드 — 전부 합쳐서 그렇다. 여기를 최적화할 여지는 없었다.
2. **ECS 실제 배포 스팬은 173~214초로 안정적**이었다. 컨테이너가 뜨고 헬스체크를 통과하고 구 태스크가 내려가는 데 걸리는 시간은 거의 일정하다.
3. **잡 소요 변동(186~348초)의 전부가 오버슛이었다.** 6초일 때도 있고 164초일 때도 있다. 이 무작위성이 결정적 단서였다.

일정한 작업이 무작위 시간을 소모하면, 원인은 작업이 아니라 **작업을 지켜보는 쪽**이다.

## 원인은 조용히 바뀐 라이브러리 기본값이었다

[`aws-actions/amazon-ecs-deploy-task-definition`](https://github.com/aws-actions/amazon-ecs-deploy-task-definition) 액션은 `wait-for-service-stability: true`일 때 AWS SDK의 `waitUntilServicesStable` 웨이터를 호출한다. [v2.6.3의 액션 소스](https://github.com/aws-actions/amazon-ecs-deploy-task-definition/blob/v2.6.3/index.js#L248-L262)를 열어보면 이렇게 넘긴다.

```js
const waiterConfig = {
  client: ecs,
  minDelay: WAIT_DEFAULT_DELAY_SEC,   // 15
  maxWaitTime: waitForMinutes * 60
};
if (waitMaxDelaySeconds) {
  waiterConfig.maxDelay = waitMaxDelaySeconds;
}
await waitUntilServicesStable(waiterConfig, { services: [service], cluster });
```

`minDelay`는 넘기는데 **`maxDelay`는 안 넘긴다.** SDK 기본값에 맡긴다는 뜻이다. 그리고 그 기본값이 바뀌었다.

```diff
# aws-sdk-js-v3, "Migrated to Smithy. No functional changes"
-  const serviceDefaults = { minDelay: 15, maxDelay: 120 };
+  const serviceDefaults = { minDelay: 15, maxDelay: 600 };
```

문제의 커밋은 [aws-sdk-js-v3의 `20258a5`](https://github.com/aws/aws-sdk-js-v3/commit/20258a5ffedcaffdf80b85eeb66d5e00057de37d)다. 커밋 메시지에 "No functional changes" 라고 적혀 있다는 게 이 글의 절반이다. 코드 생성기를 갈아끼우면서 모델에서 딸려온 값이 바뀌었고, 그걸 기능 변경으로 보지 않은 것이다.

폴링 간격 계산식은 [smithy-typescript의 `poller.ts`](https://github.com/smithy-lang/smithy-typescript/blob/main/packages/core/src/submodules/client/util-waiter/poller.ts#L128-L146)에 있다.

```js
const attemptCountCeiling = Math.log(maxDelayMs / minDelayMs) / Math.log(2) + 1;
if (attempt > attemptCountCeiling) return maxDelayMs;

const delay  = minDelayMs * 2 ** (attempt - 1);
const capped = Math.min(delay, maxDelayMs);
return randomInRange(minDelayMs, capped);   // min + Math.random() * (max - min)
```

`maxDelay = 600`을 대입하면 회차별 대기 시간이 이렇게 된다.

| 회차 | 1 | 2 | 3 | 4 | 5 | 6 | 7+ |
|---|---|---|---|---|---|---|---|
| 대기 분포 | 15s | U(15,30) | U(15,60) | U(15,120) | U(15,240) | U(15,480) | 600s 고정 |

배포가 195초쯤에 끝난다고 하면 그 시점은 대략 5~6회차 근처다. 즉 최대 240~480초짜리 주사위를 굴리고 있는 중에 배포가 끝난다. 몬테카를로로 돌려보면 오버슛 기대값은 평균 116초, p90 218초, 최악 600초다.

실측 6~164초가 이 분포에 정확히 들어간다. 6초·8초·13초·18초는 폴링이 마침 직후에 떨어진 운 좋은 케이스고, 164초는 5회차 `U(15,240)`에서 나쁜 값을 뽑은 케이스다.

기존 `maxDelay = 120`에서는 평균 오버슛이 58~64초, 상한이 120초였다. 두 배 나빠진 것이다.

## 한 줄로 고친다

액션은 폴링 상한을 직접 지정할 수 있는 [`wait-max-delay-seconds` 입력](https://github.com/aws-actions/amazon-ecs-deploy-task-definition/blob/v2.6.3/action.yml#L25-L27)을 제공한다. [PR #839](https://github.com/aws-actions/amazon-ecs-deploy-task-definition/pull/839)로 들어온 것으로, 설명에도 "If not set, AWS SDK uses exponential backoff"라고 적혀 있다.

```yaml
- name: Deploy to Amazon ECS
  uses: aws-actions/amazon-ecs-deploy-task-definition@v2
  with:
    task-definition: ${{ steps.task-def.outputs.task-definition }}
    service: ${{ env.ECS_SERVICE }}
    cluster: ${{ env.ECS_CLUSTER }}
    wait-for-service-stability: true
    wait-max-delay-seconds: 15   # 이 줄
```

`minDelay == maxDelay == 15`이면 `attemptCountCeiling = log₂(1) + 1 = 1`이 되어, 1회차는 `randomInRange(15000, 15000)`으로 정확히 15초, 2회차부터는 `attempt > 1` 조건에 걸려 무조건 `maxDelay`를 반환한다. **지터가 완전히 사라지고 15초 고정 폴링이 된다.**

오버슛은 `U[0, 15)`로 잘린다 — 평균 7.5초, 최악 15초. 잡 소요 기대값은 325초에서 215초로 떨어진다.

중요한 건 `wait-for-service-stability: true`를 **그대로 둔다**는 점이다. 느리다고 대기 자체를 끄면 배포 실패를 감지할 방법이 사라진다. 여기서 고친 건 "얼마나 자주 확인하는가"이지 "확인하는가"가 아니다.

## 주의점

**대기를 없애는 게 답인 경우는 드물다.** 이 문제를 만나면 `wait-for-service-stability: false`가 제일 먼저 떠오른다. 그러면 잡은 200초 빨라지지만 배포가 롤백돼도 초록불이 뜬다. 진단이 끝나기 전에 안전장치부터 떼면 안 된다.

**같은 증상이 업스트림에도 올라와 있다.** [이슈 #872](https://github.com/aws-actions/amazon-ecs-deploy-task-definition/issues/872)가 v2.6.3에서 "배포가 끝난 뒤 몇 분을 더 기다린다"고 보고하는데, 이 글을 쓰는 시점에 아직 열려 있다.

**액션 태그를 부동(floating)으로 쓰면 이런 게 조용히 들어온다.** `@v2`는 계속 움직인다. 이번 리그레션도 액션 자체 코드는 한 줄도 안 바뀌고 번들된 SDK 버전이 올라가면서 들어왔다. 부동 태그의 편의를 포기할 생각은 없지만, "액션 코드가 안 바뀌었으니 액션 탓이 아니다"는 추론은 틀릴 수 있다는 걸 기억해 둘 만하다.

**측정 없이 튜닝하면 엉뚱한 데를 판다.** 처음에 의심한 타깃 그룹 임계치는 `interval 30 × healthy 5 = 150초`라 계산상 가장 큰 범인처럼 보였다. 그런데 실측에서는 신규 타깃 등록 후 구 태스크가 내려가기까지 13초였다. ALB와 ECS가 명목 임계치를 다 소모하지 않는다. 이걸 모르고 튜닝했으면 인프라 설정만 흔들고 아무것도 못 줄였을 것이다. 타깃그룹을 실제로 갈아끼우는 쪽 이야기는 [ECS와 ALB의 순환 의존 끊고 타깃그룹 무중단 컷오버하기](../ecs-alb-target-group-circular-dependency/)에 적었다.

**"No functional changes" 커밋 메시지를 믿지 말자.** 작성자 입장에선 사실이었다. 코드 생성 파이프라인 교체는 기능 변경이 아니다. 다만 생성 결과물의 상수가 바뀌었고, 그 상수를 기본값으로 쓰는 하위 소비자에게는 명백한 기능 변경이었다. 라이브러리의 "기본값에 맡긴다"는 결정에는 이런 비용이 붙는다.

## 정리

- 느리다고 느끼면 **구간을 나눠서 재라.** 서로 다른 두 시스템의 타임라인을 겹치는 것만으로 원인 후보가 대부분 죽는다.
- **일정한 작업이 무작위 시간을 먹으면 관찰자를 의심하라.** 작업 자체는 173~214초로 안정적이었다.
- 재시도·폴링 라이브러리의 **`maxDelay`는 명시적으로 지정하라.** 지수 백오프는 실패를 기다릴 땐 옳지만, 완료를 기다릴 땐 그대로 지연이 된다.
