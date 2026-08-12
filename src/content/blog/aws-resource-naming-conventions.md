---
title: "제약부터 정하는 AWS 리소스 명명 규칙"
description: "ECS·ECR·TG·LB·SG·Secrets Manager의 하드 제약을 API로 직접 측정하고, AWS 공식 문서가 말하는 이름과 태그의 역할 분담을 근거와 함께 정리합니다."
pubDate: "2026-08-12T09:09:49+09:00"
category: "DevOps"
tags: ["aws", "naming-convention", "tagging", "iam", "terraform"]
---

리소스 이름 규칙 논의는 대개 취향 싸움으로 끝난다. `dev-api-tg`냐 `api-dev-tg`냐를 두고 한 시간을 쓰고, 결론은 "일단 통일하자"가 된다.

그런데 실제로 규칙을 깨뜨리는 건 취향이 아니다. 32자 상한 같은 하드 제약이고, 이름을 나중에 못 바꾼다는 사실이다. 그러니 순서를 정하기 전에 제약부터 확정하는 게 순서다.

이 글은 두 가지를 다룬다. 각 리소스의 하드 제약, 그리고 "이름에 무엇을 넣어야 하는가"에 대한 AWS 공식 문서의 입장이다.

## 하드 제약은 API가 알려준다

문서를 읽는 것보다 빠른 방법이 있다. 일부러 틀린 이름으로 생성 요청을 보내면 AWS가 검증 정규식을 그대로 에러에 담아 돌려준다. 리소스는 생성되지 않는다.

```bash
aws elbv2 create-target-group --name "under_score" \
  --protocol HTTP --port 80 --vpc-id "$VPC" --target-type ip
```

```text
An error occurred (ValidationError) when calling the CreateTargetGroup operation:
1 validation error detected: Value 'under_score' at 'targetGroupName' failed to
satisfy constraint: Member must satisfy regular expression pattern:
(?!^-)(?!.*-$)^[A-Za-z0-9-]+$
```

이렇게 모은 실측값이다.

| 리소스 | 최대 길이 | 허용 문자 (실측) |
|---|---|---|
| ELBv2 Target Group | 32 | `(?!^-)(?!.*-$)^[A-Za-z0-9-]+$` |
| ELBv2 ALB / NLB | 32 | 위와 동일 + `internal-` 로 시작 금지 |
| ECS 클러스터 | 255 | `^[a-zA-Z0-9\-_]{1,255}$` |
| ECS 서비스 | 255 | `^[a-zA-Z0-9\-_]{1,255}$` |
| ECS 태스크정의 패밀리 | 255 | 위와 동일 |
| ECR 리포지토리 | 256 | `[a-z0-9]+((\.|_|__|-+)[a-z0-9]+)*(/[a-z0-9]+(...))*` |
| Secrets Manager | 512 | 영숫자 + `- / _ + = . @ !` |
| CloudWatch Log Group | 512 | `[\.\-_/#A-Za-z0-9]+` |
| IAM Role | 64 | `[\w+=,.@-]+` |
| S3 버킷 | 63 | 소문자, 숫자, `.`, `-` |

여기서 곧바로 세 가지가 보인다.

- ECS 계열이 전부 255자인데 **ELBv2만 32자다.** 전 리소스에 같은 규칙을 적용하면 여기서만 깨진다
- ECR은 소문자만 받는다. ECS 서비스명은 대문자를 받으므로 `PaymentApi`로 통일하려 들면 ECR에서 막힌다
- 언더스코어를 쓸 수 있는 곳과 없는 곳이 갈린다. ELBv2는 하이픈만, ECS는 둘 다, ECR은 `_`와 `__`까지 허용한다

문서가 실제와 어긋나는 곳도 있다. ECR 리포지토리 이름을 두고 AWS 문서는 산문으로 *"The repository name must start with a letter"* 라고 쓰는데, 바로 아래 정규식은 `[a-z0-9]+` 로 시작해 숫자를 허용한다.

```bash
$ aws ecr create-repository --repository-name "9digitstart" \
    --query 'repository.repositoryName' --output text
9digitstart
```

정규식 쪽이 맞다. 산문이 오래된 것으로 보인다. 이런 경우 **API 응답이 정본이다.** ELBv2도 문서는 허용 문자를 "alphanumeric"이라고만 쓰지만 정규식대로 대문자가 통한다(`UpperCaseTG` 생성 확인 후 즉시 삭제).

## 32자 벽

32자는 생각보다 빨리 찬다. `{env}-{service}-{component}-tg` 형태에서 서비스명이 20자만 넘어도 초과한다. 그래서 도구들이 각자 대응하는데, **셋 다 결국 해시로 도망간다.**

**AWS Load Balancer Controller.** 쿠버네티스 Ingress를 만들면 컨트롤러가 타깃그룹 이름을 자동 생성한다.

```text
k8s-istioing-istioist-9353a399b9    (32자)
k8s-istioing-istioist-a4a335902e    (32자)
```

`k8s-{네임스페이스 8자}-{이름 8자}-{해시 10자}` 구조로 정확히 32자에 맞춰 절단한다. 원래 이름은 `istio-ingress` 와 `istio-istiod` 인데 둘 다 8자로 잘려 `istioing` / `istioist` 가 됐다. 이름만 봐서는 구분할 수 없고 해시로만 구별된다.

**Terraform `name_prefix`.** `name` 대신 `name_prefix` 를 주면 유일한 접미사를 붙여 주는데, 타깃그룹에서는 거의 쓸모가 없다.

> "name_prefix creates a 26 character random string after the prefix. However, AWS seems to only accept a max of 32 characters for this resource, leaving only 6 characters for prefix."
>
> — [terraform-provider-aws#1666](https://github.com/hashicorp/terraform-provider-aws/issues/1666)

```text
Target group name 'dev3-api00ab7d2fbb5e69734f62409381'
cannot be longer than '32' characters
```

접두사에 6자만 남는다. `dev3-api` 도 이미 8자다.

**Cloud Posse `null-label`.** Terraform 명명 규약 모듈의 사실상 표준인데, 길이 제한이 걸리면 전체 `id` 의 MD5 해시 일부로 빠진 부분을 대체한다고 문서화한다. 그러면서 이름 충돌 가능성이 남는다는 것을 스스로 밝힌다.

결국 32자 앞에서는 어떤 도구를 쓰든 "사람이 읽는 이름"이 해시로 무너진다. 선택지는 둘뿐이다.

1. ELBv2에 맞춰 전체 규칙을 짧게 설계한다 — 환경 3자(`dev`/`stg`/`prd`), 앱 약어, 컴포넌트 생략
2. ELBv2만 예외로 두고 별도 규칙을 적용한다 — 다른 리소스는 길게, ELBv2만 압축

1번은 255자를 쓸 수 있는 ECS까지 불필요하게 짧아진다. 2번은 규칙이 두 개가 된다. 공짜 선택지는 없고, 어느 쪽이든 문서에 명시해 두는 게 중요하다.

## 이름은 바꿀 수 없다

길이보다 중요한 제약이다. 대부분의 AWS 리소스는 이름을 바꿀 수 없다.

| 리소스 | 변경 | 근거의 성격 |
|---|---|---|
| RDS DB 인스턴스 식별자 | 가능 (재부팅 동반) | `ModifyDBInstance` 에 파라미터 존재 |
| S3 버킷 | 불가 | 문서에 명시된 문장 |
| ALB / NLB | 불가 | 문서에 명시된 문장 |
| Target Group | 불가 | API·콘솔에 수단 없음 |
| ECS 클러스터 / 서비스 / 패밀리 | 불가 | API에 수단 없음 |
| ECR 리포지토리 | 불가 | API에 수단 없음 |
| Secrets Manager 시크릿 | 불가 | API에 수단 없음 |
| Security Group | 불가 | API에 수단 없음 |
| CloudWatch Log Group | 불가 | API에 수단 없음 |
| IAM Role / Policy | 불가 | API에 수단 없음 |

"근거의 성격" 열을 눈여겨볼 만하다. AWS가 문장으로 못 박은 것(S3, ALB)과 API 표면에 수단이 없어 사실상 불가한 것은 다른 종류의 사실이다. 후자를 "문서에 그렇게 쓰여 있다"고 옮기면 틀린 인용이 된다.

실무적으로는 결과가 같다. 이름을 바꾸려면 리소스를 새로 만들고 트래픽을 옮긴 뒤 구 리소스를 지워야 한다. 타깃그룹 이름 하나를 바꾸려다 [ECS와 ALB의 순환 의존](../ecs-alb-target-group-circular-dependency/)에 걸리는 일도 생기고, ECR 경로를 바꾸려면 [이미지를 통째로 새 리포지토리로 옮겨야](../crane-ecr-repository-migration/) 한다.

그래서 **이름은 처음에 짓고 다시는 못 바꾸는 것**으로 취급해야 한다. 조직 개편으로 무의미해질 팀 이름, 프로젝트 코드명, 벤더 이름을 넣으면 안 되는 이유다.

### Secrets Manager는 삭제 후 30일간 이름이 안 풀린다

시크릿을 삭제해도 복구 대기 기간이 기본 30일(최소 7일)이고, 그동안 같은 이름을 다시 쓸 수 없다. 시크릿을 지웠다 같은 이름으로 재생성하는 CI/CD 파이프라인은 기본값 그대로면 30일간 실패한다.

`--force-delete-without-recovery` 로 즉시 삭제할 수 있지만, 그 경우에도 문서는 백오프 재시도를 권고한다.

> "Secrets Manager performs the actual deletion with an asynchronous background process, so there might be a short delay… If you delete a secret and then immediately create a secret with the same name, use appropriate back off and retry logic."

덤으로 시크릿 ARN에는 랜덤 6자가 붙는다(`{name}-a1b2c3`). 삭제 후 재생성하면 ARN이 바뀌어 IAM 정책에 ARN을 하드코딩한 곳이 전부 깨진다. 문서가 *"Do not end your secret name with a hyphen followed by six characters"* 라고 경고하는 것도 부분 ARN 검색과 충돌하기 때문이다.

### Security Group 이름은 VPC 단위로만 유일하다

같은 계정, 같은 리전이라도 VPC가 다르면 동명 SG가 공존한다. 계정을 조회해 보면 `default` 가 VPC 개수만큼 나온다.

```bash
$ aws ec2 describe-security-groups --output json | python3 -c '...'
총 SG: 17
이름 중복: 1 건
  default   2개  VPC: vpc-0aaa... vpc-0bbb...
```

여기서 함정이 하나 나온다. `DescribeSecurityGroups` 는 파라미터 정의가 비대칭이다.

- `GroupId.N` — *"The IDs of the security groups. Required for security groups in a nondefault VPC."*
- `GroupName.N` — *"[Default VPC] The names of the security groups."*

**`--group-names` 는 기본 VPC 전용이다.** 커스텀 VPC 환경에서는 조용히 빈 결과를 주거나 엉뚱한 그룹을 집는다. 항상 `--group-ids` 또는 `--filters Name=vpc-id,Values=...` 와 함께 쓴다.

## 이름과 태그의 역할 분담

여기서 통념이 뒤집힌다.

먼저 알아 둘 것이 있다. 블로그 글들이 흔히 인용하는 AWS 태깅 백서의 명명 관련 섹션 두 개(`standardize-names-for-aws-resources`, `best-practices-for-naming-tags-and-resources`)는 현행판에서 삭제됐다. URL은 백서 루트로 리다이렉트되는 스텁만 남아 있고, 검색 스니펫에 남은 문장들은 구판 캐시다.

현행 백서가 실제로 하는 말은 이렇다.

> "You can take a structured approach to the naming of resources, but a resource name can only hold a limited amount of information."
>
> "In 2010, AWS launched resource tags to provide a flexible and scalable mechanism for attaching metadata to your resources."

이 문장 바로 아래에 온프레미스 호스트명을 분해한 도식이 붙어 있다.

```text
phlpwcspweb3
│  │ │ │   └─ 일련번호
│  │ │ └─ Customer Service Portal
│  │ └─ web tier
│  └─ production
└─ Philadelphia 데이터센터
```

**이건 권장 패턴이 아니다.** AWS는 "이름 하나에 다 욱여넣기"의 결과물을 보여준 직후 이름이 담을 수 있는 정보가 제한적이라고 못 박고, 곧바로 태그를 대안으로 소개한다. 서사 구조 자체가 이름 인코딩에서 태그로의 이행이다.

같은 백서의 태깅 스키마 예시를 보면 더 분명하다.

| 용도 | 태그 키 | 값 예시 |
|---|---|---|
| 비용 할당 | `example-inc:cost-allocation:ApplicationId` | `DataLakeX` |
| 비용 할당 | `example-inc:cost-allocation:BusinessUnitId` | `DevOps` |
| 비용 할당 | `example-inc:cost-allocation:CostCenter` | `123-*` |
| 운영 | `example-inc:operations:Owner` | `Squad01` |
| 재해복구 | `example-inc:disaster-recovery:rpo` | `6h` |
| 데이터 분류 | `example-inc:data:classification` | `Confidential` |
| 컴플라이언스 | `example-inc:compliance:framework` | `PCI-DSS` |

환경, 소유자, 비용센터, 사업부, RPO, 데이터 등급, 컴플라이언스. 이름에 넣고 싶어지는 축이 전부 태그 키로 배치돼 있고, 이름에 넣으라는 항목은 하나도 없다. Well-Architected Framework도 조직 메타데이터를 다루는 COST03-BP02가 전부 태깅이고, 프레임워크 전체에 이름 규칙을 다루는 항목 자체가 없다.

덧붙여, EC2에서 "이름"이라고 부르는 것은 사실 `Name` 이라는 미리 정의된 태그다. 이름 대 태그의 대립 구도 자체가 부분적으로는 허구다.

### 이름에 인코딩해도 되는 세 가지 경우

AWS 문서에서 이름 인코딩이 정당화되는 사유는 정확히 셋이고, 전부 태그로는 할 수 없는 것이다.

**태그 기반 인가(TBA)를 지원하지 않는 서비스.** ARN 와일드카드 매칭이 유일한 접근 제어 수단이 된다. AWS Security Blog가 제시하는 패턴이 `[project]-[application]-[environment]-<name>` 이다.

```text
arn:aws:s3:::exco-web-nginx-dev-staticassets
```

같은 글이 문자 수 고통을 직접 드러낸다. 프로젝트 3자 + 앱 5자 + 환경 3자로 접두사를 14자에 묶고 나머지 6자만 사용자에게 남긴다. 그러면서도 비용센터는 여전히 태그로 남긴다.

**글로벌 유니크 네임스페이스.** S3 버킷은 전 세계 모든 계정이 이름 공간을 공유하므로 회사 약어 접두사가 충돌 회피 수단이다.

**이름 기반 계층적 IAM 권한.** Secrets Manager의 경로형 이름이 그렇다. AWS Prescriptive Guidance의 권장 패턴은 `<client>/<dev or prod>/<project>/<version>` 이고, 근거는 *"It helps you establish fine-grained access controls to secrets based on their names."* 다.

이 셋 중 하나가 아니라면 그 정보는 이름이 아니라 태그로 가는 게 AWS의 입장이다.

## 순서와 자동 명명

`{env}-{app}-{resource}` 인가 `{app}-{env}-{resource}` 인가. 공개된 규칙들을 모아 보면 전부 다르다.

| 순서 | 채택처 |
|---|---|
| `{org}-{env}-{workload}-{region}` | 다수 실무 블로그 |
| `{namespace}-{environment}-{stage}-{name}` | Cloud Posse `null-label` |
| `{project}-{application}-{environment}-{name}` | AWS Security Blog |
| `{organization}-{purpose}-{environment}` | AWS 계정 이름 권장 패턴 |
| `{company}-{layer}-{region}-{unique}-{env}` | AWS Prescriptive Guidance (S3 데이터레이크) |

**AWS 자신도 일관되지 않다.** 계정 이름은 `sales-catalog-prod`, S3 데이터레이크는 `anycompany-raw-useast1-12345-dev` 로 둘 다 환경이 맨 뒤다. env-first를 권하는 블로그 다수와 정면으로 충돌한다. 공식 약어 표도 존재하지 않아 조직마다 `sg`/`sgr`, `use1`/`ue1` 처럼 갈린다.

Cloud Posse `null-label` 을 쓴다면 용어 함정을 하나 알아야 한다. 이 모듈에서 `environment` 는 dev/prod가 아니라 리전이다.

```text
namespace   회사 약어 3~4자      (S3 전역 유일성 확보용)
environment 리전 약어 또는 gbl    ← dev/prod 아님
stage       계정 역할 (prod/dev)  ← 여기가 환경
name        컴포넌트 (eks, rds)
attributes  유일성 확보용 변형
```

모르고 `environment = "prod"` 를 넣는 순간 규약이 조용히 깨진다.

"리전을 이름에 넣으면 멀티리전 확장할 때 깨진다"는 조언도 흔히 보이는데, 뒷받침하는 실제 실패 사례를 찾지 못했다. 오히려 AWS 공식 가이드는 멀티리전 대비로 리전 식별자를 넣고 확장 시 그 부분만 교체하라고 권한다. 근거를 찾지 못했으므로 통념으로만 적어 둔다.

복수 출처의 유일한 교집합은 이것뿐이다.

> 어느 순서든 하나를 골라 전 조직에 일관 적용하는 것이, 특정 순서를 고르는 것보다 중요하다.

싱겁지만 근거로 뒷받침되는 결론은 이것뿐이다. 나머지는 전부 트레이드오프 주장이다. 순서 논쟁에 시간을 쓰느니 길이 예산과 변경 불가 항목을 먼저 확정하는 편이 낫다.

### 사람이 지을 것인가, 도구가 지을 것인가

CloudFormation과 CDK는 도구에 맡기라고 못 박는다. 근거가 기술적이다.

> "You can't perform an update that causes a custom-named resource to be replaced. If you must replace the resource, specify a new name." (CloudFormation)

이름을 고정하면 불변 속성 변경이 배포 실패가 되고, CDK 문서는 그 상태의 복구 수단이 "스택 삭제 후 재배포"뿐이라고 적는다. 같은 템플릿으로 스택을 여러 개 만들 수도 없다.

Terraform 커뮤니티 표준 모듈은 접두사만 사람이 정하고 유일성은 도구에 맡기는 하이브리드다. `use_name_prefix` 기본값이 `true` 다.

```hcl
resource "aws_security_group" "this" {
  name        = var.security_group_use_name_prefix ? null : local.security_group_name
  name_prefix = var.security_group_use_name_prefix ? "${local.security_group_name}-" : null
}
```

이유가 명확하다. Security Group은 이름 변경이 replacement를 유발하는데 기본 순서인 destroy-then-create는 참조 중인 리소스 때문에 실패한다. `create_before_destroy` 로 신규를 먼저 만들려면 같은 이름의 두 리소스가 잠시 공존해야 하는데, 이름이 고정되면 VPC 내 유일성 제약 때문에 불가능하다. **`name_prefix` 가 `create_before_destroy` 의 전제조건인 셈이다.**

양쪽 다 "전부 사람이 짓는다"를 지지하지 않는다. 두 진영과 충돌하지 않는 판단 기준은 replacement 빈도다.

- 자주 교체되는 리소스(Security Group, Target Group, Launch Template, IAM 정책 버전) → `name_prefix` 또는 자동 명명
- 사실상 불변이고 외부에서 문자열로 참조되는 리소스(S3 버킷, Log Group, 계정 경계를 넘는 IAM Role, ECR 리포지토리) → 규약 기반 고정 이름

자동 명명의 대가는 실재한다. `MyStack-MyQueueE6CA6235-86lqOs0JG5ZC` 같은 이름은 콘솔에서 읽기 어렵고 온콜 중에 CLI로 타이핑할 수 없어 태그와 Resource Groups로 보완해야 한다. 반대로 태그로 해결되지 않는 지점도 분명하다. 로그 그룹 이름, 신뢰 정책에 문자열로 박히는 IAM Role ARN, URL이 되는 S3 버킷 이름, 알람 메시지, 장애 중 손으로 치는 `--name`. 여기서는 예측 가능한 이름이 실질 가치를 갖는다.

## 규칙을 정하는 순서

1. **길이 예산부터 잡는다.** ELBv2가 32자다. 여기에 맞출지, 예외로 뺄지 먼저 정한다
2. **이름은 못 바꾼다고 전제한다.** 팀명·프로젝트 코드명·벤더명처럼 조직 개편으로 무의미해질 것은 넣지 않는다
3. **이름에 넣을 축은 세 가지 사유로만 정당화한다.** 태그 기반 인가 미지원, 글로벌 유니크 네임스페이스, 이름 기반 계층적 IAM. 나머지는 태그로 간다
4. **순서는 아무거나 골라 일관 적용한다.** 근거로 뒷받침되는 결론은 이것뿐이다
5. **교체가 잦은 리소스는 도구에 접미사를 맡긴다.** `name_prefix` 는 `create_before_destroy` 의 전제조건이다
6. **태그 키는 소문자 + 하이픈 + `조직명:` 프리픽스.** AWS 권고는 "태그는 적게보다 많게"다
7. **이름과 태그 어디에도 PII를 넣지 않는다.** 태그는 암호화되지 않고 청구 데이터에도 노출된다

규칙을 문서로 남길 때 위 표의 하드 제약 값을 함께 적어 둔다. 6개월 뒤에 규칙만 보고 이름을 짓는 사람은 32자 벽을 모른다.
