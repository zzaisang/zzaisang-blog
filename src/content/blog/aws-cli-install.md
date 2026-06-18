---
title: "AWS CLI 설치하기 & 계정 설정"
description: "AWS CLI 설치 및 계정 설정하는 방법입니다.환경은 Mac 입니다. Homebrew 가 설치되어 있다고 가정했을때 입니다. awscli 설치 설치(버전) 확인 aws 계정 설정 AWS configure 설정 예시 [AWS 공식문서에서 제공하는 가짜키 입니다.] AWS…"
pubDate: "2023-10-20T16:23:24+09:00"
category: "DevOps"
tags: ["aws", "awscli", "brew", "brewawscli", "brewinstall", "homebrew", "Mac", "macbrewinstall"]
---
AWS CLI 설치 및 계정 설정하는 방법입니다.  
환경은 Mac 입니다.

Homebrew 가 설치되어 있다고 가정했을때 입니다.

# awscli 설치

```bash
$ brew install awscli
```

## 설치(버전) 확인

```bash
$ aws --version

aws-cli/2.13.27 Python/3.11.6 Darwin/22.6.0 source/arm64 prompt/off # 이런식으로 나옵니다.
```

# aws 계정 설정

```bash
$ aws configure
```

> AWS configure 설정 예시 \[AWS 공식문서에서 제공하는 가짜키 입니다.\]

-   AWS Access Key ID \[None\]: AKIAIOSFODNN7EXAMPLE
-   AWS Secret Access Key \[None\]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
-   Default region name \[None\]: ap-northeast-2
-   Default output format \[None\]: ENTER

# aws 계정 및 환경 확인

## 계정 정보

```bash
$ cat ~/.aws/credentials
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## 환경 정보

```bash
$ cat ~/.aws/config
[default]
region = ap-northeast-2
```

---

출처 : [https://docs.aws.amazon.com/cli/latest/userguide/welcome-examples.html](https://docs.aws.amazon.com/cli/latest/userguide/welcome-examples.html)
