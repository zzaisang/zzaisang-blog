---
title: "basename, dirname 명령어로 파일명/경로 추출하기"
description: "Linux basename 과 dirname 명령어로 파일 경로에서 파일명, 확장자, 디렉터리를 추출하는 방법을 -s, -a 옵션 예제와 함께 정리합니다."
pubDate: "2026-06-18T09:21:00+09:00"
category: "ETC"
tags: ["linux", "shell", "basename", "dirname", "terminal"]
---

# 리눅스에서 basename과 dirname 으로 파일 이름 추출

## basename

basename 명령어를 사용하면 파일명이나 확장자를 추출할 수 있으며 파일 경로를 옵션없이 사용하면 확장자를 포함한 파일명을 추출합니다.

- 예로 /usr/lib64/libcrypt.so 라는 파일이 있을 경우 다음 명령은 libcrypt.so 을 출력합니다.

```bash
$ basename /usr/lib64/libcrypt.so

libcrypt.so
```

- 확장자를 제외한 파일명이 필요할 경우 제거할 확장자를 입력합니다.
```bash
$ basename /usr/lib64/libcrypt.so .so

libcrypt.so
```

- 또는 -s 옵션 뒤에 제거할 확장자를 명시해도 됩니다. -s 옵션은 사용할 경우 파일명 이전에 -s 와 확장자를 명시해 주어야 합니다.

```bash
$ basename -s .so /usr/lib64/libcrypt.so

libcrypt.so
```

- 여러 개의 경로에서 파일명을 추출할 경우 -a 옵션과 함께 경로를 명시해 주면 됩니다.
```bash
$ basename -a path1/file1 path2/file2 path3/file3

file1
file2
file3
```

## dirname

- 파일 경로에서 directory 를 추출하려면 dirname 명령어를 사용하면 됩니다.

```bash
$ dirname /usr/lib64/libcrypt.so

/usr/lib64
```

---
출처 : https://www.lesstif.com/lpt/basename-dirname-82215180.html