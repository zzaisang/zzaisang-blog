---
title: "ECS와 ALB의 순환 의존 끊고 타깃그룹 무중단 컷오버하기"
description: "LB에 연결되지 않은 타깃그룹으로는 ECS 서비스를 만들 수 없고, 리스너 규칙 전환은 서비스가 healthy된 뒤여야 하는 교착을 임시 규칙으로 끊는 방법을 정리합니다."
pubDate: "2026-08-10T15:51:55+09:00"
category: "DevOps"
tags: ["aws", "ecs", "alb", "target-group", "zero-downtime"]
---

ECS 서비스의 리소스명을 표준화하려고 타깃그룹을 새로 만들었다. 새 타깃그룹에 새 서비스를 붙이고, ALB 리스너 규칙만 새 타깃그룹으로 돌리면 무중단으로 끝날 일이었다. 그런데 서비스 생성 단계에서 막혔다. 그것도 "타깃그룹이 없다"가 아니라 **"타깃그룹에 로드밸런서가 연결돼 있지 않다"는** 이유로.

찾아보니 이건 설정 실수가 아니라 구조적인 교착이었다.

## 하려던 것

`{env}-svc-web` 형태로 ECS 서비스·태스크정의·타깃그룹 이름을 통일하는 작업. 기존 리소스를 이름만 바꿀 수는 없으니 새로 만들고 트래픽을 옮긴 뒤 구 리소스를 지우는 컷오버다.

```
1. 새 타깃그룹 생성
2. 새 ECS 서비스 생성 (새 타깃그룹 연결)
3. 타깃 healthy 확인
4. ALB 리스너 규칙을 새 타깃그룹으로 전환
5. 구 서비스·구 타깃그룹 삭제
```

2번에서 멈췄다.

```text
An error occurred (InvalidParameterException) when calling the CreateService operation:
The target group with targetGroupArn
arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/dev-svc-web/0f3a9c52d81b6e47
does not have an associated load balancer.
```

## 왜 순환인가

두 서비스의 제약이 서로를 물고 있다.

**ECS 쪽 제약** — 서비스에 붙이는 타깃그룹은 이미 로드밸런서에 연결돼 있어야 한다. ECS는 태스크를 타깃그룹에 등록하고 그 헬스 상태로 배포 성패를 판정하는데, 로드밸런서가 없으면 헬스체크 자체가 돌지 않기 때문이다.

**ALB 쪽 제약** — 타깃그룹이 "로드밸런서에 연결됐다"고 인정받으려면, 리스너의 기본 동작이나 리스너 규칙 중 하나가 그 타깃그룹을 forward 대상으로 가리켜야 한다. 타깃그룹을 만드는 것만으로는 연결되지 않는다.

**그런데 규칙 전환은 3번 다음이어야 한다.** 타깃이 하나도 healthy하지 않은 타깃그룹으로 실트래픽을 보내면 그 순간 503이다. 무중단을 하려는 작업에서 가장 하면 안 되는 일이다.

정리하면 이렇다.

```
ECS 서비스 생성  ──기다림──▶  타깃그룹이 LB에 연결되기를
       ▲                              │
       │                              ▼
   기다림                      리스너 규칙 전환
       │                              │
       └──────────  기다림  ◀─────────┘
              (서비스가 healthy 되기를)
```

## "LB 연결"과 "트래픽 수신"을 분리해 끊는다

핵심은 이거다. **ALB가 요구하는 건 "규칙이 이 타깃그룹을 가리킬 것"이지, "그 규칙에 트래픽이 실제로 도달할 것"이 아니다.**

그러니 타깃그룹을 가리키되 **어떤 요청도 매칭될 수 없는** 규칙을 하나 만들면 된다. 호스트 조건에 절대 해석되지 않는 이름을 쓴다.

여기서 아무 문자열이나 쓰면 안 된다. 오타나 우연으로 실서비스 도메인과 겹칠 위험이 있고, 미래에 누군가 그 도메인을 실제로 등록할 수도 있다. **RFC 6761이 `.invalid`를 이 용도로 예약해 뒀다.** 공인 DNS에 존재할 수 없도록 표준으로 못 박힌 TLD다.

```bash
REGION=ap-northeast-2
LB_ARN=$(aws elbv2 describe-load-balancers --names svc-lb \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$LB_ARN" \
  --query "Listeners[?Port==\`443\`].ListenerArn" --output text)

TG_ARN=$(aws elbv2 create-target-group \
  --name dev-svc-web \
  --protocol HTTP --port 3000 \
  --vpc-id "$VPC_ID" --target-type ip \
  --health-check-path /api/health \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# 임시 규칙 — 도달 불가능한 호스트로 타깃그룹을 LB에 "연결만" 한다
aws elbv2 create-rule \
  --listener-arn "$LISTENER_ARN" \
  --priority 100 \
  --conditions Field=host-header,Values=cutover-dev-placeholder.invalid \
  --actions Type=forward,TargetGroupArn="$TG_ARN"
```

우선순위는 기존 규칙과 겹치지 않는 큰 숫자를 쓴다. 호스트가 어차피 매칭되지 않으니 평가 순서는 의미가 없지만, 실수로 기존 규칙보다 앞서지 않게 하는 편이 안전하다.

이제 `create-service`가 통과한다.

## 전체 순서

```
1. 새 타깃그룹 생성
2. 임시 리스너 규칙 생성        ← 타깃그룹을 LB에 연결 (트래픽 0)
3. 새 ECS 서비스 생성           ← 막혔던 지점, 이제 통과
4. 타깃 healthy 확인
5. 진짜 리스너 규칙 전환        ← 실 호스트를 새 타깃그룹으로
6. 임시 리스너 규칙 삭제
7. 구 서비스·구 타깃그룹 삭제
```

2번이 앞으로 왔고, 6번이 새로 생겼다. **4번이 3번과 5번 사이에 있다는 게 이 순서의 전부다.**

## 4번 healthy 확인

```bash
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" \
  --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State]' --output text
```

```text
10.0.30.117     healthy
10.0.31.204     healthy
```

`initial`이면 아직 헬스체크 임계치를 못 채운 것이고, `unhealthy`면 헬스체크 경로나 포트, 보안그룹을 봐야 한다. 이 단계를 건너뛰고 5번으로 가면 컷오버가 곧 장애다.

## 5번 규칙 전환은 modify-rule로

규칙을 **지웠다가 새로 만들면 그 사이에 공백이 생긴다.** 그 짧은 순간 요청은 리스너 기본 동작으로 떨어진다. `modify-rule`로 기존 규칙의 action만 교체하면 원자적이다.

```bash
# 실 호스트를 가리키는 규칙의 ARN을 찾는다
RULE_ARN=$(aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" \
  --query "Rules[?Conditions[?Values[?@=='app-dev.example.com']]].RuleArn" --output text)

aws elbv2 modify-rule --rule-arn "$RULE_ARN" \
  --actions Type=forward,TargetGroupArn="$TG_ARN"
```

## 주의점

### 같은 타깃그룹을 가리키는 규칙이 여러 개일 수 있다

이게 가장 위험하다. 호스트 하나만 생각하고 규칙 하나만 바꾼 뒤 구 타깃그룹을 지우면, 남아 있던 다른 규칙의 경로가 그 순간 죽는다.

전환 **전에** 구 타깃그룹을 참조하는 규칙을 전부 찾는다.

```bash
aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" \
  --query "Rules[?Actions[?TargetGroupArn=='$OLD_TG_ARN']].[Priority,Conditions[0].Values[0]]" \
  --output text
```

```text
2       app.example.com
7       legacy.example.com
```

실제로 이 확인에서 예상하지 못한 규칙 하나를 더 찾았다. 우선순위 7번, 서비스 초기에 쓰던 별도 도메인이었다. 놓쳤다면 구 타깃그룹 삭제와 동시에 그 호스트가 503이 됐을 것이다.

### 임시 규칙은 즉시 지운다

컷오버가 끝나면 6번을 바로 한다. 리스너 규칙 수에는 상한이 있고, 무엇보다 다음에 이 리스너를 보는 사람이 `.invalid` 규칙의 용도를 알 수 없다. 남겨 두면 그냥 정체불명의 설정이다.

```bash
aws elbv2 delete-rule --rule-arn "$TEMP_RULE_ARN"
```

### Priority는 문자열이다

위 쿼리들에서 `Priority`를 비교할 때 백틱 숫자를 쓰면 아무것도 잡히지 않는다. ELBv2 API는 `Priority`를 문자열로 돌려준다(기본 규칙이 `"default"`라 숫자 타입이 될 수 없다).

```bash
--query "Rules[?Priority==\`4\`]"     # 매칭 없음
--query "Rules[?Priority=='4']"       # 정상
```

이런 종류의 함정은 [AWS CLI와 zsh에서 검증이 거짓말하는 방식](../zsh-aws-cli-verification-pitfalls/)에 더 정리해 뒀다.

### 삭제 전 참조 0건 확인

타깃그룹 삭제는 되돌릴 수 없다. 지우기 직전에 참조가 실제로 0건인지 다시 본다. "아까 바꿨으니 없겠지"로 넘어가면 안 된다.

## 다른 방법은 왜 안 되나

**리스너 기본 동작을 임시로 새 타깃그룹에 준다** — 안 된다. 기본 동작은 어떤 규칙에도 매칭되지 않은 요청을 받는 자리다. 실트래픽이 흘러간다.

**새 ALB를 따로 만든다** — DNS 전환이 필요해지고, TTL이 남아 있는 동안 두 곳으로 트래픽이 갈린다. 무중단이 깨지는 지점이 오히려 늘어난다.

**구 타깃그룹을 그대로 쓰고 서비스만 교체한다** — 타깃그룹 이름을 표준화하려던 목적 자체가 사라진다.

`.invalid` 임시 규칙은 추가 리소스도, DNS 변경도, 트래픽 위험도 없이 순환만 끊는다. 규칙 하나를 만들고 지우는 게 전부다.

## 정리

- ECS는 **LB에 연결된 타깃그룹만** 서비스에 붙일 수 있고, 타깃그룹은 **리스너 규칙이 가리켜야** 연결된 것으로 인정된다
- 그런데 실 규칙 전환은 타깃이 healthy된 뒤여야 하므로 교착이 생긴다
- **도달 불가능한 호스트를 조건으로 한 임시 규칙**이 "연결"과 "트래픽"을 분리해 순환을 끊는다
- 임시 호스트는 **RFC 6761 `.invalid`** 를 쓴다. 실 도메인과 절대 겹치지 않는다
- 전환 전에 **구 타깃그룹을 참조하는 규칙을 전부** 찾는다. 하나만 보고 넘어가면 삭제 시점에 장애가 난다
- 규칙 전환은 삭제·재생성이 아니라 `modify-rule`로 한다
