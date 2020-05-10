# Migration `20200510165128-init`

This migration has been generated at 5/10/2020, 4:51:28 PM.
You can check out the [state of the schema](./schema.prisma) after the migration.

## Database Steps

```sql
PRAGMA foreign_keys=OFF;

CREATE TABLE "quaint"."Website" (
"id" INTEGER NOT NULL  PRIMARY KEY AUTOINCREMENT,"scraped" BOOLEAN NOT NULL DEFAULT false ,"url" TEXT NOT NULL  )

CREATE TABLE "quaint"."Page" (
"error" TEXT   ,"id" INTEGER NOT NULL  PRIMARY KEY AUTOINCREMENT,"scraped" BOOLEAN NOT NULL  ,"url" TEXT NOT NULL  ,"websiteId" INTEGER   ,FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE)

CREATE TABLE "quaint"."Product" (
"currency" TEXT NOT NULL  ,"id" INTEGER NOT NULL  PRIMARY KEY AUTOINCREMENT,"imageUrl" TEXT NOT NULL  ,"pageId" INTEGER   ,"price" REAL NOT NULL  ,"title" TEXT NOT NULL  ,"url" TEXT NOT NULL  ,FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE)

PRAGMA "quaint".foreign_key_check;

PRAGMA foreign_keys=ON;
```

## Changes

```diff
diff --git schema.prisma schema.prisma
migration ..20200510165128-init
--- datamodel.dml
+++ datamodel.dml
@@ -1,0 +1,36 @@
+datasource db {
+  provider = "sqlite"
+  url      = "file:dev.b"
+}
+
+generator client {
+  provider = "prisma-client-js"
+}
+
+model Website {
+  id      Int     @default(autoincrement()) @id
+  url     String
+  pages   Page[]
+  scraped Boolean @default(false)
+}
+
+model Page {
+  id        Int       @default(autoincrement()) @id
+  url       String
+  scraped   Boolean
+  products  Product[]
+  website   Website?  @relation(fields: [websiteId], references: [id])
+  websiteId Int?
+  error     String?
+}
+
+model Product {
+  id       Int    @default(autoincrement()) @id
+  title    String
+  price    Float
+  currency String
+  url      String
+  imageUrl String
+  page     Page?  @relation(fields: [pageId], references: [id])
+  pageId   Int?
+}
```


