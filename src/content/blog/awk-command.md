---
title: "awk 명령어로 텍스트 데이터 추출하기"
description: "Linux awk 명령어로 텍스트 데이터를 검사·조작·출력하는 방법. df -h 출력 예제로 특정 열, 마지막 컬럼, 조건 필터 추출법을 다룹니다."
pubDate: "2026-06-18T09:20:00+09:00"
category: "ETC"
tags: ["linux", "shell", "awk", "terminal", "text-processing"]
---

# awk 명령어

 - Linux 파일 텍스트의 데이터 검사, 조작, 출력 을 할 수 있다.
 - 사용해 보니 awk 명령어만 잘 사용하면 원하는 데이터를 거의 모두 추출 할 수 있을거 같다.

---

### 사용 예

 - 기본 출력
```bash
 sangjaekim@gimsangjaeui-MacBookPro  /  df -h
Filesystem                                                                      Size   Used  Avail Capacity iused      ifree %iused  Mounted on
/dev/disk1s5                                                                   233Gi   10Gi  130Gi     8%  484184 2447617136    0%   /
devfs                                                                          191Ki  191Ki    0Bi   100%     662          0  100%   /dev
/dev/disk1s1                                                                   233Gi   91Gi  130Gi    42% 1202798 2446898522    0%   /System/Volumes/Data
/dev/disk1s4                                                                   233Gi  2.0Gi  130Gi     2%       2 2448101318    0%   /private/var/vm
map auto_home                                                                    0Bi    0Bi    0Bi   100%       0          0  100%   /System/Volumes/Data/home
```

 - 2,3,4 열만 출력 (탭으로 구분)
 ```bash
 sangjaekim@gimsangjaeui-MacBookPro  /  df -h | awk '{print $2 "\t" $3 "\t" $4}'
Size	Used	Avail
233Gi	10Gi	130Gi
191Ki	191Ki	0Bi
233Gi	91Gi	130Gi
233Gi	2.0Gi	130Gi
auto_home	0Bi	0Bi
Studio	Code.app	233Gi
 ```

 - 사용한 용량이 5Gb 이하인 경로 모두 출력
 ```bash
 sangjaekim@gimsangjaeui-MacBookPro  /  df -h | awk ' $3 < 5Gi { print }'
/dev/disk1s5                                                                   233Gi   10Gi  130Gi     8%  484184 2447617136    0%   /
devfs                                                                          191Ki  191Ki    0Bi   100%     662          0  100%   /dev
/dev/disk1s4                                                                   233Gi  2.0Gi  130Gi     2%       2 2448101318    0%   /private/var/vm
map auto_home                                                                    0Bi    0Bi    0Bi   100%       0          0  100%   /System/Volumes/Data/home
 ```

 - 마지막 컬럼 1개
```bash
sangjaekim@gimsangcBookPro  ~  df -h | awk '{print $NF}'
on
/
/dev
/System/Volumes/Data
/private/var/vm
/System/Volumes/Data/home
/private/var/folders/rt/mvv1chv94sq2tr30f65jyhb80000gn/T/AppTranslocation/AA6BB639-835B-480B-BD5F-87C618902840
```

 - 마지막 컬럼 2개

```bash
sangjaekim@gimsangcBookPro  ~  df -h | awk '{print $(NF-1) "\t" $NF}'
Mounted	on
0%	/
100%	/dev
0%	/System/Volumes/Data
0%	/private/var/vm
100%	/System/Volumes/Data/home
0%	/private/var/folders/rt/mvv1chv94sq2tr30f65jyhb80000gn/T/AppTranslocation/AA6BB639-835B-480B-BD5F-87C618902840
```

참조자료 : <https://recipes4dev.tistory.com/171>