---
title: "[MongoDB 개념] CUD Operations"
description: "MongoDB CUD Operations Create(insert) Operation Document가 _id 필드를 지정하지 않으면 MongoDB는 ObjectId 값이 있는 _id 필드를 새 문서에 추가합니다. _id 필드는 중복키를 허용하지 않습니다. (PK) 단일…"
pubDate: "2022-04-19T17:12:17+09:00"
updatedDate: "2022-04-21T14:28:41+09:00"
category: "Database"
---
# MongoDB CUD Operations

## Create(insert) Operation

-   Document가 \_id 필드를 지정하지 않으면 MongoDB는 ObjectId 값이 있는 \_id 필드를 새 문서에 추가합니다.
-   \_id 필드는 중복키를 허용하지 않습니다. (PK)

### 단일 insert (insertOne)

```javascript
db.inventory.insertOne(
   { item: "canvas", qty: 100, tags: ["cotton"], size: { h: 28, w: 35.5, uom: "cm" } }
)
```

### 다중 insert (insertMany)

```javascript
db.inventory.insertMany([
   { item: "journal", qty: 25, tags: ["blank", "red"], size: { h: 14, w: 21, uom: "cm" } },
   { item: "mat", qty: 85, tags: ["gray"], size: { h: 27.9, w: 35.5, uom: "cm" } },
   { item: "mousepad", qty: 25, tags: ["gel", "blue"], size: { h: 19, w: 22.85, uom: "cm" } }
])
```

---

## Update Operation

-   db.collection.updateOne(, , ) : 단일 업데이트 document 의 filed 변경
-   db.collection.updateMany(filter, update, options) : 다중 업데이트
-   db.collection.replaceOne(filter, replacement, options) : document 전체 변경
-   하위처럼 데이터 있다고 가정

```javascript
db.inventory.insertMany( [
   { item: "canvas", qty: 100, size: { h: 28, w: 35.5, uom: "cm" }, status: "A" },
   { item: "journal", qty: 25, size: { h: 14, w: 21, uom: "cm" }, status: "A" },
   { item: "mat", qty: 85, size: { h: 27.9, w: 35.5, uom: "cm" }, status: "A" },
   { item: "mousepad", qty: 25, size: { h: 19, w: 22.85, uom: "cm" }, status: "P" },
   { item: "notebook", qty: 50, size: { h: 8.5, w: 11, uom: "in" }, status: "P" },
   { item: "paper", qty: 100, size: { h: 8.5, w: 11, uom: "in" }, status: "D" },
   { item: "planner", qty: 75, size: { h: 22.85, w: 30, uom: "cm" }, status: "D" },
   { item: "postcard", qty: 45, size: { h: 10, w: 15.25, uom: "cm" }, status: "A" },
   { item: "sketchbook", qty: 80, size: { h: 14, w: 21, uom: "cm" }, status: "A" },
   { item: "sketch pad", qty: 95, size: { h: 22.85, w: 30.5, uom: "cm" }, status: "A" }
] );
```

#### updateOne

```javascript
db.inventory.updateOne(
   { item: "paper" },
   {
     $set: { "size.uom": "cm", status: "P" },
     $currentDate: { lastModified: true }
   }
)
```

#### updateMany

```javascript
db.inventory.updateMany(
   { "qty": { $lt: 50 } },
   {
     $set: { "size.uom": "in", status: "P" },
     $currentDate: { lastModified: true }
   }
)
```

---

## Delete Operation

-   db.collection.deleteOne() : 단일 Document 삭제 처리
-   db.collection.deleteMany() : 다중 Document 삭제 처리

### 삭제 조건 ( RDB : where 문과 동일)

```
{ <field1>: <value1>, ... } # RDB : WHERE file = value1
{ <field1>: { <operator1>: <value1> }, ... } # RDB : where file in value ... 등 조건
```

-   하위 처럼 데이터 있다고 가정

```javascript
db.inventory.insertMany( [
   { item: "journal", qty: 25, size: { h: 14, w: 21, uom: "cm" }, status: "A" },
   { item: "notebook", qty: 50, size: { h: 8.5, w: 11, uom: "in" }, status: "P" },
   { item: "paper", qty: 100, size: { h: 8.5, w: 11, uom: "in" }, status: "D" },
   { item: "planner", qty: 75, size: { h: 22.85, w: 30, uom: "cm" }, status: "D" },
   { item: "postcard", qty: 45, size: { h: 10, w: 15.25, uom: "cm" }, status: "A" },
] );
```

### 단일 delete

```javascript
db.inventory.deleteOne({status:"D"})
```

-   단일 document 삭제 시 status 가 D 인게 2개 이지만 먼저 들어온 순으로 한개만 삭제 되어서 삭제 후 status 가 D 인것을 조회하면 한개만 나온다.

```javascript
db.inventory.find({status : "D"})

[
    {
        _id: ObjectID("blah~ blah~"),
        item: 'planner',
        qty: 75,
        size: {h: 22.85, w: 30, uom: 'cm'},
        status : 'D'
    }
]
```

### 다중 delete

-   status 가 A 인 데이터 모두 삭제 처리
    
    ```javascript
    db.inventory.deleteMany( { status: "A" } )
    ```
