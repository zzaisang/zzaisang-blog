---
title: "AWS EC2에 scp로 파일 전송하기"
description: "FileZilla 같은 FTP 없이 scp 명령어로 EC2 서버와 파일을 송수신하는 방법. -r, -P, -i 등 주요 옵션과 사용 예시를 정리합니다."
pubDate: "2026-06-18T09:16:00+09:00"
category: "DevOps"
tags: ["aws", "ec2", "scp", "ssh", "file-transfer"]
---

# aws scp 로 파일 전송하기.

 - aws ec2 사용하다보면 서버에 올라가 있는 파일을 로컬에서 사용해야 할 때가 있다.
 - 그런데 fileZilla 같은 ftp 소프트웨어를 사용하지 않거나 ec2 서버가 public 이 아닌 private 망으로 연결 되어 있을 때 scp 명령어로 파일을 송/수신 할 수 있다.

### scp 명령어 사용하기
```bash
scp [옵션][Source경로][Target경로]
```

 - 옵션
   - -r : 재귀적으로 폴더의 모든 내용을 복사, 폴더를 복사할 때 사용
   - -P : ssh포트 지정 옵션
   - -i : ssh 키파일과 같은 identity file의 경로를 지정하는 옵션
   - -v : verbose 모드로 상세내용을 보며 디버깅 할 때 사용
   - -p : 파일의 수정시간과 권한 유지

### scp 사용하기 (ssh 접속이 가능한 pem파일 파일 및 config 설정이 다 되어 있을 때)

 - ec2 서버 -> 로컬 PC (다운로드)

```bash
scp [태그명]:[파일경로] [다운 받을 위치]

scp dev-ysf-api:log/helloWorld .
```
