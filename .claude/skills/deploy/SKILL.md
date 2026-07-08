---
name: deploy
description: 一條龍發布流程：更新快取時間戳 → git commit → push 到 GitHub → firebase deploy。當使用者說「部署」「deploy」「push」「上線」「發布」時使用。
---

# Deploy（commit & push & deploy to Firebase）

本專案同時使用 GitHub（版本控制）與 Firebase Hosting（網頁代管），發布時兩者必須一起更新。依序執行以下步驟，任一步失敗就停下回報，不要繼續往下走。

## 1. 檢查變更

```bash
git status --porcelain && git diff --stat
```

- 若工作區乾淨且沒有未 push 的 commit（`git log origin/main..main` 為空），回報「沒有需要發布的變更」並結束。
- 若只有未 push 的 commit（工作區乾淨），跳過步驟 2、3，直接從步驟 4 開始。

## 2. 更新快取時間戳（Cache Busting）

若這次變更動到了 `.js` 或 `.css` 檔案，**必須**先更新 `index.html` 中對應資源的 `?t=` 時間戳為當下時間（格式 `YYYYMMDDHHMM`，取本地時間 `date +%Y%m%d%H%M`）：

- `<link rel="stylesheet" href="style.css?t=...">`（css 有改才更新）
- `<script src="script.js?t=..."></script>`（js 有改才更新）

沒動到 js/css（例如只改 README）就跳過此步。

## 3. Commit

- 訊息格式依 repo 慣例：Conventional Commits 前綴（`feat:` / `fix:` / `style:` / `chore:` / `docs:`）+ 繁體中文描述，參考 `git log --oneline -10`。
- **禁止**加入任何 AI 署名（"Generated with Claude Code"、`Co-Authored-By: Claude` 等一律不加）。
- 一次變更包含多個不相關主題時，拆成多個 commit。

```bash
git add -A && git commit -m "<type>: <繁中描述>"
```

## 4. Push 到 GitHub

```bash
git push origin main
```

push 失敗（例如 remote 有新 commit）時先 `git pull --rebase origin main` 再重試；有衝突就停下回報，不要自行 force push。

## 5. 部署到 Firebase

```bash
firebase deploy --only hosting
```

- 部署設定在 `firebase.json`（public 為專案根目錄，已忽略 README.md 與 LICENSE）。
- 若出現未登入錯誤，請使用者自行執行 `firebase login` 後再重跑本 skill，不要代為處理登入。

## 6. 回報

完成後回報：commit hash 與訊息、push 結果、firebase deploy 輸出的 Hosting URL。
