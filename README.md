# 冰箱库存 — 部署说明

## 第一步：上传到 GitHub

1. 打开 github.com，点右上角 "+" → "New repository"
2. 名字填 `fridge-inventory`，选 Public，点 "Create repository"
3. 点 "uploading an existing file"，把这个文件夹里的所有文件拖进去上传
4. 点 "Commit changes"

## 第二步：Vercel 部署

1. 打开 vercel.com，用 GitHub 账号登录
2. 点 "Add New Project" → 选 `fridge-inventory` 仓库 → 点 "Deploy"
3. 等待部署完成（约1分钟），得到一个 .vercel.app 网址

## 第三步：添加 KV 数据库（共享数据）

1. 在 Vercel 项目页面，点顶部 "Storage" 标签
2. 点 "Create Database" → 选 "KV" → 名字填 `fridge-kv` → Create
3. 点 "Connect to Project"，选你的项目，确认
4. 回到项目，点 "Redeploy"（重新部署一次让环境变量生效）

## 完成！

把网址发到家庭群，所有人打开就可以用，数据实时共享。

手机浏览器可以"添加到主屏幕"，用起来和 App 一样。
