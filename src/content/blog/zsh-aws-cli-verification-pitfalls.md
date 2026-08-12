---
title: "빈 결과를 성공으로 읽는 zsh·AWS CLI 함정 넷"
description: "삭제 전 안전 확인 스크립트가 두 번의 실패를 '일치'로 보고했습니다. zsh 워드분할과 AWS CLI 페이지네이션·JMESPath 타입 함정을 실제 사례로 정리합니다."
pubDate: "2026-08-10T16:50:33+09:00"
category: "DevOps"
tags: ["zsh", "aws-cli", "jmespath", "shell", "pagination"]
---

구 ECR 리포지토리를 삭제해도 되는지 확인하는 스크립트를 짰다. 가동 중인 태스크가 참조하는 이미지 태그가 신·구 리포지토리에 모두 같은 digest로 존재하는지 비교하는, 열 줄짜리 스크립트였다.

`OK`가 떴다. 삭제하려다 태그 개수가 눈에 안 맞아 다시 봤다. **스크립트는 아무것도 검증하지 않고 있었다.**

원인을 파고들면서 네 가지 함정을 연달아 밟았다. 넷 다 같은 실패 모양을 만든다. **틀린 명령이 에러 대신 빈 결과를 내고, 빈 결과가 성공으로 해석된다.**

## 문제의 스크립트

```bash
RUNNING=$(aws ecs list-tasks --cluster dev-cluster --query 'taskArns' --output text)

for t in $RUNNING; do
  TAG=$(aws ecs describe-tasks --cluster dev-cluster --tasks "$t" \
        --query '...' --output text)

  OLD=$(aws ecr describe-images --repository-name myapp-api \
        --image-ids imageTag="$TAG" --query 'imageDetails[0].imageDigest' --output text)
  NEW=$(aws ecr describe-images --repository-name app/api \
        --image-ids imageTag="$TAG" --query 'imageDetails[0].imageDigest' --output text)

  [ "$OLD" = "$NEW" ] && echo "OK"
done
```

논리는 맞아 보인다. 실제로는 `for` 문이 **한 번만** 돌았고, 그 한 번마저 API 호출이 전부 실패했으며, 실패한 두 값이 서로 같아서 `OK`가 출력됐다.

## 1. zsh는 따옴표 없는 변수를 워드분할하지 않는다

bash에서:

```bash
$ RUNNING="a b c"
$ for t in $RUNNING; do echo "[$t]"; done
[a]
[b]
[c]
```

zsh에서:

```bash
% RUNNING="a b c"
% for t in $RUNNING; do echo "[$t]"; done
[a b c]
```

zsh의 기본 동작이다. POSIX 셸은 따옴표 없는 파라미터 확장 결과를 `IFS` 기준으로 단어 분할하지만, **zsh는 `SH_WORD_SPLIT` 옵션이 꺼져 있어 분할하지 않는다.** 배열이 아닌 스칼라는 통째로 한 단어다.

macOS는 Catalina부터 기본 셸이 zsh다. bash 습관으로 쓴 스크립트가 CI(대개 bash)에서는 돌고 로컬에서만 다르게 동작한다. 그것도 에러 없이.

### 그래서 무슨 일이 일어났나

`$RUNNING`에는 태스크 ARN 여러 개가 탭으로 구분돼 들어 있었다. zsh가 분할하지 않으니 `$t`에 **ARN 목록 전체가 한 덩어리로** 들어갔다.

그 문자열로 `describe-tasks`를 부르면 당연히 실패한다. `$TAG`는 빈 문자열이 된다. 빈 태그로 `describe-images`를 두 번 부르니 둘 다 실패한다. `$OLD`도 `$NEW`도 빈 문자열이다.

```bash
[ "" = "" ]     # 참
```

**두 번의 실패가 "일치"로 보고됐다.**

### 고침

```bash
RUNNING=()
while IFS= read -r arn; do
  [ -n "$arn" ] && RUNNING+=("$arn")
done < <(aws ecs list-tasks --cluster dev-cluster \
         --query 'taskArns[]' --output text | tr '\t' '\n')

if [ ${#RUNNING[@]} -eq 0 ]; then
  echo "가동 중인 태스크가 없다 — 검증 불가" >&2
  exit 1
fi

for t in "${RUNNING[@]}"; do
  ...
done
```

두 가지를 바꿨다. **배열 + 인용**으로 셸 차이를 없앴고, **빈 결과를 성공이 아니라 실패로 처리**했다.

`setopt SH_WORD_SPLIT`으로 zsh를 bash처럼 만들 수도 있지만 권하지 않는다. 스크립트가 실행 환경의 옵션 설정에 의존하게 된다. 배열을 쓰는 편이 어느 셸에서도 같다.

### 진짜 교훈은 셸이 아니다

셸 차이는 계기일 뿐이다. 근본 결함은 **빈 값과 실패를 구분하지 않는 비교**다.

```bash
[ "$OLD" = "$NEW" ]     # 둘 다 실패해도 참
```

검증에서 비교는 마지막에 와야 한다. 그 앞에 "비교할 값이 실제로 존재하는가"가 있어야 한다.

```bash
for v in "$OLD" "$NEW"; do
  case "$v" in
    ""|"None")
      echo "digest 조회 실패 — 검증 무효" >&2
      exit 1
      ;;
  esac
done

[ "$OLD" = "$NEW" ] || { echo "digest 불일치: $OLD vs $NEW" >&2; exit 1; }
```

AWS CLI는 값이 없을 때 빈 문자열이 아니라 **문자열 `None`을** 내는 경우가 많다. `--output text`에서 특히 그렇다. 둘 다 막아야 한다.

## 2. `--max-items`는 출력에 페이지네이션 토큰을 덧붙인다

최근 태스크정의 두 개만 보려고 했다.

```bash
$ aws ecs list-task-definitions --family-prefix dev-svc-api \
    --sort DESC --max-items 2 --output text
TASKDEFINITIONARNS      arn:aws:ecs:ap-northeast-2:123456789012:task-definition/dev-svc-api:328
TASKDEFINITIONARNS      arn:aws:ecs:ap-northeast-2:123456789012:task-definition/dev-svc-api:327
eyJuZXh0VG9rZW4iOiBudWxsLCAiYm90b190cnVuY2F0ZV9hbW91bnQiOiAyfQ==
```

마지막 줄이 정체다. `--max-items`는 **서버 파라미터가 아니라 CLI 클라이언트 측 절단**이고, 잘린 지점을 이어받을 수 있도록 pagination token을 출력에 함께 낸다.

이걸 `$( )`로 받아 단어 목록으로 쓰면 토큰이 항목 하나로 섞인다.

```text
An error occurred (ClientException) when calling the DescribeTaskDefinition operation:
Unable to describe task definition. ... None
```

### 고침

`--max-items`를 쓰지 말고 파이프에서 자른다.

```bash
aws ecs list-task-definitions --family-prefix dev-svc-api --sort DESC \
  --query 'taskDefinitionArns[]' --output text | tr '\t' '\n' | head -2
```

`--no-paginate`로 토큰 출력을 막는 방법도 있지만, 그러면 첫 페이지만 받는다. 목적이 "정렬 후 최근 N개"라면 위처럼 전체를 받아 자르는 쪽이 의도에 맞다.

## 3. `--query`는 자동 페이지네이션 중 페이지마다 적용된다

4개만 요청했는데 12개가 나온다.

```bash
$ aws ecr list-images --repository-name app/api \
    --query 'imageIds[:4]' --output text | wc -l
      12
```

AWS CLI는 응답이 여러 페이지면 자동으로 이어 받는다. 그런데 `--query`를 **합쳐진 최종 결과가 아니라 각 페이지에** 적용한다. 3페이지 × 4개 = 12.

같은 이유로 `length()`도 못 믿는다.

```bash
$ aws ecr describe-images --repository-name app/api \
    --query 'length(imageDetails)' --output text
100
100
100
4
```

총 304개인데 페이지별 개수가 줄줄이 나온다. 이걸 `$( )`로 받아 숫자로 쓰면 곧바로 틀린다. 게다가 "100"이 그럴듯한 숫자라서 잘못됐다는 걸 알아채기 어렵다.

### 고침

절단과 집계는 CLI 밖에서 한다.

```bash
# 개수
aws ecr list-images --repository-name app/api --filter tagStatus=TAGGED --output json \
  | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["imageIds"]))'

# 상위 N
aws ecr list-images --repository-name app/api \
  --query 'imageIds[].imageTag' --output text | tr '\t' '\n' | head -4
```

규칙 한 줄로 줄이면 이렇다. **`--query`는 필드 선택에 쓰고, 슬라이싱·집계에는 쓰지 않는다.**

## 4. JMESPath에서 ALB `Priority`는 문자열이다

리스너 규칙 중 우선순위 4번을 찾으려 했다.

```bash
$ aws elbv2 describe-rules --listener-arn "$L" \
    --query 'Rules[?Priority==`4`]' --output text
$
```

아무것도 안 나온다. 규칙이 없어서가 아니다.

ELBv2 API는 `Priority`를 **문자열**로 돌려준다(`"4"`). 기본 규칙의 우선순위가 `"default"`이기 때문에 이 필드는 숫자 타입이 될 수 없다. JMESPath의 백틱은 JSON 리터럴이므로 `` `4` ``는 숫자 `4`이고, 문자열 `"4"`와 같지 않다.

### 고침

```bash
aws elbv2 describe-rules --listener-arn "$L" \
  --query "Rules[?Priority=='4']" --output text
```

이런 타입 불일치는 생각보다 흔하다. 포트 번호, 개수, 버전 같은 필드도 API에 따라 문자열일 수 있다.

같은 함정을 실제 컷오버에서 밟은 이야기는 [ECS와 ALB의 순환 의존](../ecs-alb-target-group-circular-dependency/)에 적었다.

**빈 결과가 나오면 "조건에 맞는 게 없다"고 결론짓기 전에 원본 JSON에서 그 필드의 실제 타입을 본다.**

```bash
aws elbv2 describe-rules --listener-arn "$L" --output json | head -20
```

## 넷은 같은 실패 모양을 만든다

넷은 서로 무관한 버그 같지만, 만들어내는 실패 모양이 같다.

| 함정 | 겉으로 보이는 결과 |
|---|---|
| zsh가 분할하지 않아 반복문이 한 번만 돈다 | 빈 값 |
| 토큰이 섞여 API 호출이 실패한다 | 빈 값 / `None` |
| 페이지별 query로 개수가 틀린다 | 그럴듯한 숫자 |
| 타입 불일치로 필터가 안 맞는다 | 빈 목록 |

전부 **에러 없이 빈 결과**다. 그리고 대부분의 셸 비교문에서 빈 결과는 조용히 참이 된다.

그래서 삭제나 컷오버처럼 되돌릴 수 없는 작업의 사전 검증 스크립트에는 규칙 하나가 필요하다.

> **"찾은 게 없다"와 "찾지 못했다"를 반드시 구분한다.**

구체적으로는 이렇게 한다.

- 기대 개수를 알고 있으면 그 개수를 **단언**한다. `[ "$n" -eq 303 ]`
- 0건이 정상인지 비정상인지 **스크립트가 알고 있어야** 한다
- 조회 실패는 빈 값이 아니라 **exit 1**로 만든다
- 비교 전에 **양쪽 값의 존재를 먼저 확인**한다

실제로 고친 뒤의 검증은 개수 비교 하나가 아니라 세 가지를 본다. 태그 집합의 차집합, 공통 태그의 digest 일치, 그리고 지금 가동 중인 태그가 실제로 존재하는지. 이 얘기는 [crane으로 ECR 리포지토리를 무중단 이관한 기록](../crane-ecr-repository-migration/)에 이어서 적었다.

## 정리

- **zsh는 따옴표 없는 스칼라를 워드분할하지 않는다.** 배열 + `"${arr[@]}"`로 쓰면 셸 차이가 사라진다
- **`--max-items`는 `--output text`에 pagination token을 덧붙인다.** 파이프에서 `head`로 자른다
- **`--query`는 자동 페이지네이션 중 페이지마다 적용된다.** 슬라이싱·집계에 쓰지 않는다
- **JMESPath 비교는 타입이 맞아야 한다.** 빈 결과가 나오면 원본 JSON의 타입부터 본다
- 그리고 무엇보다, **빈 결과를 성공으로 해석하지 않는 검증**을 짠다
