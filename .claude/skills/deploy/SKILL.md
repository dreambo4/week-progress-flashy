---
name: deploy
description: 一條龍發布流程：更新快取時間戳 → git commit → push 到 GitHub（GitHub Actions 自動部署 Firebase Hosting）→ 確認 CI 結果。當使用者說「部署」「deploy」「push」「上線」「發布」時使用。
---

# Deploy（commit & push → GitHub Actions 自動部署 Firebase Hosting）

push 到 `main` 會觸發 `.github/workflows/firebase-hosting-merge.yml`，由 CI 部署 Firebase Hosting（live channel）。**本機不再執行 `firebase deploy --only hosting`**，否則會重複部署。依序執行以下步驟，任一步失敗就停下回報，不要繼續往下走。

## 1. 檢查變更

```bash
git status --porcelain && git diff --stat
```

- 若工作區乾淨且沒有未 push 的 commit（`git log origin/main..main` 為空），回報「沒有需要發布的變更」並結束。
- 若只有未 push 的 commit（工作區乾淨），跳過步驟 2、3，直接從步驟 4 開始。

## 2. 更新快取時間戳（Cache Busting）

若這次變更動到了 `.js` 或 `.css` 檔案，**必須**先更新 `index.html` 中**對應那支檔案**的 `?t=` 時間戳為當下時間（格式 `YYYYMMDDHHMM`，取本地時間 `date +%Y%m%d%H%M`）：

- `css/*.css` → `<link rel="stylesheet" href="css/xxx.css?t=...">`
- `js/*.js`、根目錄 `game.js` / `calendar.js` / `calendar-ui.js` / `leaderboard.js` → `<script src="...?t=..."></script>`

只更新有改到的檔案；沒動到 js/css（例如只改 README）就跳過此步。CI 不會改檔案，時間戳必須在 commit 前更新。

## 3. Commit

- 訊息格式依 repo 慣例：Conventional Commits 前綴（`feat:` / `fix:` / `style:` / `chore:` / `docs:` / `ci:`）+ 繁體中文描述，參考 `git log --oneline -10`。
- **禁止**加入任何 AI 署名（"Generated with Claude Code"、`Co-Authored-By: Claude` 等一律不加）。
- 一次變更包含多個不相關主題時，拆成多個 commit。

```bash
git add -A && git commit -m "<type>: <繁中描述>"
```

## 4. 檢查 Firestore rules／索引是否有異動

CI 只部署 Hosting。push 前檢查這次要推上去的 commit 是否動到 Firestore 設定：

```bash
git fetch -q origin && git diff --name-only origin/main..HEAD -- firestore.rules firestore.indexes.json
```

有輸出 → **明確提醒使用者**：「這次改到 Firestore rules／索引，CI 不會部署，需要另外執行 `firebase deploy --only firestore`」。不要自行執行，由使用者決定時機。

## 5. Push 到 GitHub

```bash
git push origin main
```

push 失敗（例如 remote 有新 commit）時先 `git pull --rebase origin main` 再重試；有衝突就停下回報，不要自行 force push。

## 6. 確認 CI 部署結果

```bash
gh run list -R dreambo4/week-progress-flashy -w "Deploy to Firebase Hosting on merge" -L 1
gh run watch <run-id> -R dreambo4/week-progress-flashy --exit-status
```

- 失敗時用 `gh run view <run-id> --log-failed` 看錯誤並回報。
- 常見失敗：secret `FIREBASE_SERVICE_ACCOUNT_WEEK_PROGRESS_UFKAQ` 失效或權限不足 → 請使用者重跑 `firebase init hosting:github`。

## 7. 回報

完成後回報：commit hash 與訊息、push 結果、CI run 結果與連結、網站 https://week-progress-ufkaq.web.app ；若步驟 4 有 Firestore 異動，再次提醒需手動部署 rules。
