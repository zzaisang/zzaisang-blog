---
title: "MariaDB 테이블 Dump(백업)·복원하기"
description: "mysqldump 로 MariaDB 테이블을 백업하고 복원하는 방법. 전체 덤프, 특정 테이블 제외 덤프, 단일 테이블 덤프, 덤프 파일 재적재까지 옵션별 명령어로 정리합니다."
pubDate: "2026-06-18T09:00:00+09:00"
category: "Database"
tags: ["mariadb", "mysqldump", "backup", "dump", "restore"]
---

# Maria DB 테이블 Dump(백업) 하기

### 덤프 옵션
 - 'u' : 아이디
 - 'p' : 비밀번호
 - 'ysf_dev' : 대상 database(schema)
 - '>' : dump output 
 - '<' : dump input   
 - 'data-dump-ysf.sql' : 해당 파일로 input Or output

### 전체 테이블 dump
```bash
mysqldump -uysf_dev --port=3306 --host=localhost -p1234 ysf_dev > data-dump-ysf.sql
```

### 이벤트 테이블을 제외한 전체 테이블 dump
```bash
mysqldump -uysf_dev --port=3306 --host=localhost -p1234 ysf_dev --ignore-table=mysql.event > data-dump-ysf.sql
```

### 특정 테이블 dump (test_table) 만 dump
```bash
mysqldump -uysf_dev --port=3306 --host=localhost -p1234 ysf_dev test_table > data-dump-ysf.sql
```

### dump 데이터 적재(input)
```bash
mysql -uysf_dev --port=3306 --host=localhost -p1234 ysf_dev < data-dump-ysf.sql
```
