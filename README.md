# Tokyo Streets 3D — 東京步行世界

真實 **OpenStreetMap** 渋谷街道／建築 + **Three.js** 第一人稱步行。  
日本特色街景、便利店進店、鐵路站月台、日語廣播與進店音樂。

線上：https://pakho2433.github.io/tokyo/

## 功能

- **人中之龍風街景**：密集看板、霓虹、自販機、赤提灯、電線杆、雨後水窪
- **便利店**：街道可見 FamilyMart／7-Eleven／LAWSON 風店鋪；靠近按 **E** 進店並播放進店音樂
- **鉄道駅**：渋谷駅外觀＋高架線；進入月台後列車到站有メロディ、到站音、日語廣播
- **環境音**：横断歩道 ピヨピヨ、都市 hum、日夜循環

> 音效與店招為**原創程序化重現**，非官方授權資產或商標遊戲素材。

## 操作

| 裝置 | 操作 |
|------|------|
| 手機／iPad | 左下角搖桿走路；畫面右側滑動環視；點擊底部提示進出 |
| 電腦 | WASD 移動；滑鼠拖曳環視；**E** 進出店／駅；Shift 衝刺 |
| 重置 | 右上角 📍 |

## 啟動

```bat
cd C:\Users\user\tokyo-3d-world
start.bat
```

或：

```bat
python -m http.server 8765
```

開啟 http://localhost:8765

## 資料

- 建築輪廓／道路：OpenStreetMap（`assets/shibuya-osm.json`）
- 地標高度：公開建築高度資料

```bat
python scripts/fetch_osm.py
```

## 說明

可玩的網頁 3D 步行原型。視覺方向參考寫實都市開放世界遊戲的電影感；未使用 GTA 或《人中之龍》的遊戲資產。
