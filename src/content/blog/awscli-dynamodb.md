---
title: "awscli 로 dynamoDB 사용하기"
description: "awscli 가 설치 안되신 분들은 AWSCLI 설치 해당 글을 참조하세요. dynamoDB 관련 검색 위 처럼 입력하면 vi 모드로 들어가게 됩니다. Q 키를 클릭하면 나올 수 있습니다. AWS Command Line Interface (AWS CLI)를 사용하여 Amazon…"
pubDate: "2023-10-20T17:49:28+09:00"
category: "DevOps"
tags: ["aws", "awscli", "awsclidynamodb", "dynamodb", "keyvaluedb", "NoSQL"]
---
awscli 가 설치 안되신 분들은 [AWSCLI 설치](../aws-cli-install/) 해당 글을 참조하세요.

---

# dynamoDB 관련 검색

```bash
$ aws dynamodb help
```

위 처럼 입력하면 vi 모드로 들어가게 됩니다. Q 키를 클릭하면 나올 수 있습니다.

AWS Command Line Interface (AWS CLI)를 사용하여 Amazon DynamoDB와 상호 작용할 수 있습니다. AWS CLI를 통해 DynamoDB에 대한 다양한 기능을 실행할 수 있습니다. 아래는 일반적인 DynamoDB 작업 및 AWS CLI 명령의 몇 가지 예시입니다.

# 테이블 생성 및 관리

```bash
$ aws dynamodb create-table --table-name MyTable --attribute-definitions AttributeName=ID,AttributeType=S --key-schema AttributeName=ID,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

# 테이블을 삭제

```bash
$ aws dynamodb delete-table --table-name MyTable
```

# 데이터 삽입 및 조회

```bash
$ aws dynamodb put-item --table-name MyTable --item '{"ID": {"S": "123"}, "Name": {"S": "John"}}'
```

데이터 조회는 aws dynamodb query나 aws dynamodb scan 명령을 사용하여 수행합니다. 이 명령은 쿼리 및 스캔 작업을 지원하며, 필요에 따라 쿼리 표현식을 지정할 수 있습니다.

# 데이터 수정

```bash
$ aws dynamodb update-item --table-name MyTable --key '{"ID": {"S": "123"}}' --update-expression "SET Age = :newAge" --expression-attribute-values '{":newAge": {"N": "30"}}'
```

# 데이터 삭제

```bash
$ aws dynamodb delete-item --table-name MyTable --key '{"ID": {"S": "123"}}'
```

# 테이블 설명 및 상태 확인

```bash
aws dynamodb describe-table --table-name MyTable
```

# 배치 작업

대규모 작업을 수행하려면 aws dynamodb batch-write-item 명령을 사용하여 여러 항목을 한 번에 삽입, 수정 또는 삭제할 수 있습니다.
