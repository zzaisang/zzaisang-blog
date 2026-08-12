---
title: "crane으로 ECR 리포지토리 무중단 이관하기"
description: "docker pull/push 대신 crane을 쓰는 이유인 manifest digest 보존과, 생성→복사→검증→플립 순서 그리고 롤백이 대칭이 아니라는 점을 정리합니다."
pubDate: "2026-08-10T15:48:03+09:00"
category: "DevOps"
tags: ["crane", "ecr", "docker", "registry", "ci-cd"]
---

CI가 이미지를 밀어 넣는 ECR 경로를 `myapp-api`에서 `app/api`로 바꿔야 했다. 앱이 여러 개로 늘면서 네임스페이스 없는 평평한 이름이 규칙에서 벗어났기 때문이다.

간단해 보이지만 두 군데가 걸린다. **이미지를 어떻게 옮기느냐**, 그리고 **언제 경로를 바꾸느냐**다. 둘 다 대충 하면 롤백이 막힌다.

## crane을 쓰는 이유는 digest 보존이다

`docker pull` 하고 태그 바꿔 `docker push` 하면 되는 것 아닌가 싶다. 이미지 "내용"은 같지만 **manifest digest가 달라질 수 있다.**

- Docker는 pull 과정에서 manifest를 재구성할 수 있다. 미디어 타입 변환, 스키마 버전 변환이 일어난다
- 멀티 아키텍처 이미지라면 `docker pull`은 현재 플랫폼 것만 가져온다. 그대로 push하면 image index가 사라지고 단일 플랫폼 이미지가 된다
- digest가 바뀌면 `image@sha256:...`로 고정한 배포 매니페스트, 이미지 서명, SBOM이 전부 어긋난다

`crane`은 레지스트리 API를 직접 다룬다. manifest 바이트를 그대로 옮기므로 digest가 보존된다. Google의 [go-containerregistry](https://github.com/google/go-containerregistry) 프로젝트에 들어 있는 CLI다.

부수 효과가 하나 더 있다. **같은 레지스트리 안의 cross-repository 복사는 blob mount로 처리된다.** 레이어를 내려받아 다시 올리는 대신, 레지스트리에게 "이 blob을 저 리포지토리에도 달아라"라고 요청한다. 덕분에 303개 태그 48.78 GB를 몇 분에 옮겼다. 네트워크로 흐른 건 manifest뿐이다.

## 설치

```bash
# macOS
brew install crane
```

```bash
# Linux
VERSION=$(curl -s https://api.github.com/repos/google/go-containerregistry/releases/latest \
          | jq -r .tag_name)
curl -sL "https://github.com/google/go-containerregistry/releases/download/${VERSION}/go-containerregistry_Linux_x86_64.tar.gz" \
  | sudo tar -xz -C /usr/local/bin crane
```

Go 툴체인이 있으면 이쪽이 짧다.

```bash
go install github.com/google/go-containerregistry/cmd/crane@latest
```

## ECR 인증

```bash
REG=123456789012.dkr.ecr.ap-northeast-2.amazonaws.com

aws ecr get-login-password --region ap-northeast-2 \
  | crane auth login "$REG" -u AWS --password-stdin
```

`crane auth login`은 `~/.docker/config.json`에 자격증명을 쓴다. **Docker 데몬은 필요 없다.** crane은 레지스트리와 직접 HTTP로 통신한다. ECR 토큰은 12시간짜리이므로 긴 작업이면 만료를 염두에 둔다.

## 기본 명령

```bash
crane copy SRC DST                 # 단일 태그 복사
crane copy --all-tags SRC DST      # 리포지토리 전체 복사
crane ls REPO                      # 태그 목록
crane digest REPO:TAG              # manifest digest
crane manifest REPO:TAG            # manifest 원문
crane config REPO:TAG              # 이미지 config (레이어·env·entrypoint)
```

이관에 실제로 쓴 건 한 줄이다.

```bash
crane copy --all-tags "$REG/myapp-api" "$REG/app/api"
```

`--all-tags`는 **태그가 붙은 것만** 옮긴다. 태그 없는 dangling manifest는 따라오지 않는다. 대부분의 경우 그게 맞는 동작이다.

## 순서가 전부다

CI는 `ECR_REPOSITORY`라는 변수 하나로 push 대상을 정한다. 값을 바꾸면 경로가 옮겨진다. 그 값을 **언제** 바꾸느냐가 핵심이다.

```
1. 새 리포지토리 생성
2. 태그 복사
3. 복사 검증
4. 변수 플립
```

**역순이면 깨진다.** 변수를 먼저 바꾸면 다음 CI push가 존재하지 않는 리포지토리를 향한다.

```text
RepositoryNotFoundException: The repository with name 'app/api' does not exist
in the registry with id '123456789012'
```

ECR은 push 시점에 리포지토리를 자동 생성하지 않는다(리포지토리 생성 템플릿을 따로 설정한 경우가 아니라면).

### 1. 기존 설정을 미러링해 리포지토리 생성

새로 만들면 AWS 기본값이 적용된다. 구 리포지토리와 설정이 다르면 동작이 조용히 바뀐다. 먼저 읽는다.

```bash
aws ecr describe-repositories --repository-names myapp-api \
  --query 'repositories[0].{mutability:imageTagMutability,scan:imageScanningConfiguration,enc:encryptionConfiguration}'

aws ecr get-lifecycle-policy   --repository-name myapp-api --query lifecyclePolicyText --output text
aws ecr get-repository-policy  --repository-name myapp-api --query policyText          --output text
```

뒤 두 명령이 `LifecyclePolicyNotFoundException` / `RepositoryPolicyNotFoundException`을 내면 정책이 없다는 뜻이다. **있으면 새 리포지토리에 그대로 옮겨야 한다.** 특히 라이프사이클 정책을 빠뜨리면 이미지가 무한정 쌓인다.

```bash
aws ecr create-repository \
  --repository-name app/api \
  --image-tag-mutability MUTABLE \
  --encryption-configuration encryptionType=AES256 \
  --image-scanning-configuration scanOnPush=false
```

### 2. 복사

```bash
crane copy --all-tags "$REG/myapp-api" "$REG/app/api"
```

303개 태그가 약 6분 걸렸다. 진행 로그가 태그마다 나오므로 오래 걸리는 작업이면 백그라운드로 돌리고 태그 수를 폴링하는 편이 편하다.

```bash
aws ecr list-images --repository-name app/api --filter tagStatus=TAGGED --output json \
  | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["imageIds"]))'
```

### 3. 검증은 세 가지를 본다

개수만 세면 부족하다. 태그 집합의 차집합, 공통 태그의 digest 일치, 그리고 지금 가동 중인 태그가 실제로 있는지까지 확인한다.

```python
import subprocess, json

def tagmap(repo):
    out = subprocess.run(
        ['aws', 'ecr', 'list-images', '--repository-name', repo,
         '--filter', 'tagStatus=TAGGED', '--output', 'json'],
        capture_output=True, text=True)
    m = {}
    for i in json.loads(out.stdout)['imageIds']:
        if i.get('imageTag'):
            m[i['imageTag']] = i['imageDigest']
    return m

old, new = tagmap('myapp-api'), tagmap('app/api')

missing  = sorted(set(old) - set(new))
mismatch = [t for t in set(old) & set(new) if old[t] != new[t]]

print('개수         %d → %d' % (len(old), len(new)))
print('누락         %d %s' % (len(missing), missing[:10]))
print('digest 불일치 %d %s' % (len(mismatch), mismatch[:10]))

for tag in ('90836d1', '3f0c3b2'):          # dev / prod 가동분
    ok = old.get(tag) and old[tag] == new.get(tag)
    print('%s %s' % (tag, 'OK' if ok else 'FAIL'))
```

```text
개수         303 → 303
누락         0 []
digest 불일치 0 []
90836d1 OK
3f0c3b2 OK
```

**AWS CLI의 `--query`로 개수를 세지 않은 이유가 있다.** `--query`는 자동 페이지네이션 중 각 페이지에 적용되어 `length()`가 페이지별로 여러 줄 나온다. 그걸 그대로 숫자로 쓰면 틀린다. 이런 함정은 [검증 스크립트가 OK를 위조한 날](../zsh-aws-cli-verification-pitfalls/)에 따로 정리했다.

### 4. 변수 플립

GitHub Actions라면 여기서 확인할 게 하나 있다. 같은 이름의 변수가 **Repository 레벨과 Environment 레벨에 동시에 존재**할 수 있고, **Environment 값이 이긴다.**

빌드 잡에는 `environment:` 선언이 없고 배포 잡에만 있는 구성이 흔하다. 이때 Repository 변수만 바꾸면 이렇게 된다.

```
빌드 잡  → Repository 변수만 읽음 → app/api 로 push
배포 잡  → Environment 변수 우선  → myapp-api 를 조회 → 이미지 없음
```

플립 전에 세 곳을 다 본다. Repository Variables, Environment `dev`, Environment `prod`. Environment에도 있으면 **동시에** 바꾼다.

## 롤백은 대칭이 아니다

이관 계획서에 이렇게 적혀 있었다.

> 변수를 되돌리면 구 태그를 그대로 쓸 수 있다.

**틀렸다.** 정확히는 **플립 이전 SHA에 대해서만** 맞다.

플립 후 CI가 만든 신규 이미지는 새 리포지토리에만 쌓인다. 이 상태에서 변수를 되돌리면 구 리포지토리를 보게 되는데, 거기엔 최신 이미지가 없다. 배포 워크플로가 이미지 존재를 검증한다면 그 지점에서 막힌다.

```text
시간 ────────────────────────────▶
                  플립
구 리포지토리  ████████████│
신 리포지토리  ████████████│████████████
                           ↑
                  이 구간의 SHA는 구 리포지토리에 없다
```

대응은 단순하다. **전체 태그를 복사하고 구 리포지토리를 남겨 둔다.** 그러면 양방향이 다 성립한다.

일부만 복사하는 선택지가 있었다. 계획서에는 "최소 가동분 2개"라고 적혀 있었다. 저장 비용을 아끼는 대신 **롤백 가능 지점이 2개로 줄어든다.** 프로덕션 롤백은 대개 "N-1, N-2로 되돌리기"인데 그 창을 스스로 좁히는 셈이다.

48 GB 중복은 ECR 요금으로 월 5달러 남짓이고, 구 리포지토리를 지우는 순간 사라진다. 롤백 창과 바꿀 값은 아니다.

## 구 리포지토리는 언제 지우나

바로 지우지 않는다. 최소한 **정규 배포 사이클이 새 경로로 한 번 돌 때까지** 남긴다. 이관 직후에 하는 검증 배포는 대개 같은 이미지를 다시 올린 것이라 실전이 아니다.

지우기 전에 계정 전체에서 참조를 확인한다.

```bash
for c in $(aws ecs list-clusters --query 'clusterArns[]' --output text | tr '\t' '\n'); do
  for s in $(aws ecs list-services --cluster "$c" --query 'serviceArns[]' --output text | tr '\t' '\n'); do
    td=$(aws ecs describe-services --cluster "$c" --services "$s" \
         --query 'services[0].taskDefinition' --output text)
    aws ecs describe-task-definition --task-definition "$td" \
      --query 'taskDefinition.containerDefinitions[].image' --output text \
      | grep -q 'myapp-api' && echo "참조 발견: $s"
  done
done
```

삭제는 되돌릴 수 없다.

```bash
aws ecr delete-repository --repository-name myapp-api --force
```

`--force`는 이미지가 남아 있어도 지운다. 즉 이 명령 하나로 48 GB가 사라진다. 위 확인을 건너뛰지 않는다.

## 정리

- **crane을 쓰는 이유는 편해서가 아니라 digest가 보존되기 때문이다.** `image@sha256:` 고정, 이미지 서명, SBOM이 걸려 있다면 `docker pull/push`로 옮기면 안 된다
- **같은 레지스트리 내 복사는 blob mount로 처리된다.** 수십 GB도 실제 전송 없이 몇 분이다
- **순서는 생성 → 복사 → 검증 → 플립.** 역순이면 다음 push가 `RepositoryNotFoundException`으로 실패한다
- **새 리포지토리는 구 리포지토리 설정을 미러링한다.** 라이프사이클 정책 누락이 특히 조용하다
- **전체 태그를 복사한다.** 부분 복사는 롤백 창을 스스로 좁힌다
- **롤백은 대칭이 아니다.** 변수를 되돌리는 것만으로는 플립 이후 이미지를 되찾을 수 없다
- **구 리포지토리는 실전 배포가 한 사이클 돈 뒤에 지운다**
