# Week Progress Project Rules

## Cache Busting (靜態資源快取清除)
- 當修改了 JavaScript (`.js`) 或 CSS (`.css`) 檔案時，請**務必主動檢查** `index.html`。
- 請將 `<script src="...?t=">` 與 `<link href="...?t=">` 後方的時間戳參數（如 `?t=YYYYMMDDHHMM`）更新為當下的時間。
- 在提交更新（Git Commit/Deploy）前，這必須是標準流程的一部分，以確保部署後不會產生舊的瀏覽器快取。

## Deployment Workflow (部署流程)
- 當使用者要求「部署 (deploy)」或「推送 (push)」時，由於本專案同時使用了 GitHub 進行版本控制與 Firebase Hosting 作為網頁代管，請**務必同時執行**以下兩項操作：
  1. 將變更提交並推送至 GitHub (`git add . && git commit -m "..." && git push`)。
  2. 部署至 Firebase (`firebase deploy`)。
