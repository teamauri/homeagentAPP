# AURI Family App — High-Level Design Doc

> 手机端 App 是 **AURI（会看的家庭机器人）的家庭侧同伴应用**。
> 本文整合目前所有产品/设计决策：目标、导航、文案、数据模型、3 天范围。
> 最后更新：2026-06-18 · 状态：Day 1 地基已完成并入库。

---

## 1. 产品定位

AURI 是一台**会看的家庭机器人**——官网主张 **"It sees — so it can help."**
手机 App 不是通用聊天机器人，而是这台机器人的**家庭侧入口**：家人在这里派活、确认、
回看机器人拍的成片，并随时间积累出一个**只懂你家孩子的"家庭管家"**。

**核心差异化（护城河）**：App 攒下家庭的**长期结构化 context**（成员档案 + 观察日志），
所以它能给出**通用 GPT 给不出**的洞察与效用——因为别处没有你家的历史。

### 输入是多来源的（不是"父母把信息扔给 AI"）
1. **父母发起** —— 打字/语音派活，例如设一个 reminder。
2. **外部源接入 → 父母确认 → 落地** —— Calendar / Email / Photos 被解析成建议，父母确认后入库。
3. **机器人端发起** —— Cameraman 拍成片、reminder 的视频回执、routine 语音 logging、阅读、健身、情绪陪伴。

**家庭群 = 任务板**：群里有家人 + AI 队友，大白话派活，队友接走、办完回报，重要的带**视频回执**。

---

## 2. Demo 目标 & 原则

| 项 | 决定 |
|---|---|
| **首要目标** | **投资人/讲故事 demo**：视觉精致 + 点击流畅 + 完整故事线优先 |
| **AI** | **接入真实 AI**（不是纯 fixtures）。现有 **Gemini (VLM) + DeepSeek (LLM)** setup 保留不动 |
| **工期** | **3 个工作日**完成整个 demo app |
| **导航** | **Hybrid**：家庭群(Chat)作首页 + 待确认 Inbox(Today) + 记忆档案(Memory) |
| **队友命名** | 以官网为准：**Iris / Lumi / Vita / Nova / Sera**（+ Auri 设备） |
| **设计** | 对齐官网 tokens（paper/mint/coral/violet + Fraunces/Nunito） |

**设计原则**
- *Work-object-first*，不是 chat-first 的通用助手——产出的是可确认的工作对象（reminder、日程、相册、回执、洞察）。
- *Calm*：Today 是一个平静的收件箱，AI 替你干完，你只管确认。
- *Proof*：重要的事带视频回执，"它会看"是音箱给不了的。
- *Warm & premium*：暖纸色、衬线标题、克制。

---

## 3. AI 队友（Teammates）

> 角色围绕"机器人会看"组织。Iris/Lumi/Vita 在**家庭群**里；Nova/Sera 是**私下**陪你的，不在群里。

| 队友 | Tagline | 职责 | 颜色 | Scope |
|---|---|---|---|---|
| **Iris** | the eye | 拍下 firsts、机器人成片、整理家庭相册、视频回执 | coral `#FF7A59` | group |
| **Lumi** | the companion | 陪孩子读书、有问必答、阅读 moment | violet `#9D6BF2` | group |
| **Vita** | the keeper | 日程 / 提醒 / 喂药·午睡记录 / 邮件 / 家庭统筹 / 回执 | mint `#2E7B5B` | group |
| **Nova** | the coach | 你的居家健身、数次数、看动作 | neutral | private |
| **Sera** | the calm | 难的时候陪你做个呼吸、需要时引你到真人 | neutral | private |
| **Auri** | the robot | 设备本身 / 路由——把对的队友叫来 | mint | device |

代码来源：`src/lib/team.ts`（UI 元数据）、`src/lib/demo/family-context.ts`（喂 LLM 的路由 context）。

---

## 4. 信息架构 / 导航

**三个 surface，默认落地在「家庭群（Chat）」**——这是产品灵魂所在。
底部常驻**统一输入口**（打字 / 拍照 / 语音），一个入口喂三件事：派活、传照片、记一笔。

```
┌───────────────────────────────────────────────┐
│  顶部分段导航：  Today   [ Chat ]   Memory      │   ← Chat 默认选中（首页）
├───────────────────────────────────────────────┤
│                                                 │
│              当前 surface 内容                   │
│                                                 │
├───────────────────────────────────────────────┤
│  ＋   Ask Auri anything…            🎤    ↑      │   ← 统一 composer
└───────────────────────────────────────────────┘
```

### 4.1 Chat —— 家庭群（默认首页）
- 标题：**"Jane's Family"**
- 家人（Mom=Jane、Dad=Marcus）+ 群内队友（Iris/Lumi/Vita）的对话流。
- 队友的结构化卡片：日程草稿、提醒、**视频回执（▶）**、相册草稿、阅读 moment。
- 私聊入口：**"For you" → Nova / Sera**（群外）。

### 4.2 Today —— 平静的收件箱（确认队列）
- 问候：**"Good afternoon, Jane."**
- **① Needs You（主角）**：AI 产出的待确认草稿——确认入库 / 编辑 / 忽略。
- **② Upcoming**：已确认的紧凑日程条（接下来 3–4 条）。
- **③ Auri Robot 状态**卡 + **Your team** 一览。
- （stretch）**Connect**：接 Google/Apple 日历。

### 4.3 Memory —— 家庭记忆档案
- 标题：**"Jane's Memory"**
- 时间线：Iris 成片 + **整理出来的家庭相册** + 阅读 moment + 视频回执。
- 来源筛选：**All / Auri / Phone / Reading**。
- 档案是你的：可导出/删除。

---

## 5. 三个真实 Task（3 天范围）

> 串成一个闭环：②③ 产生真实**观察** → 写进成员 profile → ① 据此给出"GPT 给不出"的洞察。

```
② 整理相册   →  对孩子的观察（恐龙书反复出现…）
③ 喝药视频回执 →  健康/routine 记录（连续按时、时间戳…）
              ↓ 都写进 profile 的「观察日志」
① home agent  →  基于你家专属的长期 context 给洞察/效用
```

### Task ① — Home Agent 洞察（Gemini）
- 家庭成员 **profile**（兴趣 / 节奏 / 健康）+ **观察日志**（来自 ②③ 的真实事件）。
- Gemini 消费它 → 生成 **Insight 卡**（结论 + 依据 + 可执行动作）。
- 示例文案：
  - 🦕 *"Mia keeps reaching for dinosaur books this week (7 photos + 2 reading sessions) — a trip to the natural history museum on Saturday, or this new book."*
  - 💊 *"Leo's evening medicine ran late twice this week (video receipts at 21:10, 21:24) — want to move the reminder to 20:30?"*
  - 📷 *"You haven't been in a single family photo for 9 days — you're always the one filming. Let Iris grab a group shot this weekend."*

### Task ② — 真整理相册（Iris · Gemini vision）
- 系统照片选择器选一批**真照片** → Gemini **配文 / 按事件聚类 / 识别孩子 / 挑精选 / 起标题**。
- 产物：家庭相册进 Memory；并把对孩子的观察写进 profile（喂 ①）。
- Web 现实：相册是"选择器"而非静默全量读取——选是真的、整理是真的。

### Task ③ — Reminder → 机器人端 → 视频回执闭环
- 父母在 App 下发 reminder（如"Mia 喝 XX 药"）→ 轻后端真同步。
- **机器人端是另一个已有的 App（带后端）**，展示 reminder、家里人录一段喝药视频。
- 回执视频**由机器人端后端直接给文件**——我方 App 不模拟录像/上传，只对接 + 展示（群里 ▶）。
- 回执完成 → 产出健康/routine 记录（喂 ①）。
- 〔待办〕拿到机器人端 repo，对齐对接契约。

**砍掉**：拍传单/粘贴邮件 → 日程（原 Task B，本期不做）。

---

## 6. 数据模型（地基已建）

`src/lib/family/profile.ts`：
- **`FamilyMemberProfile`** = { id, name, role, ageLabel, avatar, interests[], routines[], health[] }
- **`Observation`** = { memberId, source, note, tags[], observedAt }
  - `source ∈ album_organize | reminder_receipt | robot_clip | reading_session | manual`
- 种子家庭：**Jane（妈）/ Marcus（爸）/ Mia（4，爱恐龙、在吃 10 天药）/ Leo（7，周五篮球）**。

聊天契约：`src/lib/chat-server/types.ts`（`ChatAIResponse` → reply + cards[] + objectsToCreate[]）。

---

## 7. AI / 后端

- **Gemini（VLM）+ DeepSeek（LLM）** 现有 setup **保留**。链路：DeepSeek → Gemini → 关键词兜底。
  - 照片/回执等**多模态**走 **Gemini（vision）**；文本路由/结构化可走 DeepSeek。
  - 缺 key 时走 `src/lib/demo/fallback-handler.ts` 的关键词兜底（仍渲染队友卡片）。
- **轻后端真同步**（Task ③）：定义 `reminders / receipts` 契约，机器人端按契约接入。
  - 注：长驻 server 可两台真手机同步；若上 Vercel serverless，需换 KV/Postgres（同契约）。

---

## 8. 技术栈 & 设计 tokens

- **Next.js 14 + React 18 + Tailwind**（mobile-first，外套 iPhone 外壳）。
- 设计 tokens（`tailwind.config.ts` / `globals.css`，对齐官网）：
  - 色：paper `#FBF8F2` · ink `#1D1B17` · mint `#2E7B5B` · coral `#FF7A59` · violet `#9D6BF2` · line `#E9E2D6`
  - 字：标题 **Fraunces**（衬线）· 正文 **Nunito Sans** · 手写点缀 **Caveat**

---

## 9. 关键 UI 文案（Copy）

| 位置 | 文案 |
|---|---|
| 定位主张 | *It sees — so it can help.* |
| Composer 占位 | *Ask Auri anything…* |
| Today 问候 | *Good afternoon, Jane.* |
| Chat 标题 | *Jane's Family* |
| Memory 标题 | *Jane's Memory* |
| Today 分区 | *Needs You* · *Upcoming* · *Your team* · *Recent in Memory* |
| Memory 筛选 | *All · Auri · Phone · Reading* |
| 私聊入口 | *For you — Nova · Sera* |
| 卡片 CTA | *Review · Confirm · Edit · Open draft · Watch · View* |
| Robot 状态 | *Auri Robot · Living Room · Ready · not recording* |

---

## 10. 3 天计划 & 状态

| Day | 内容 | 状态 |
|---|---|---|
| **Day 1** | 地基：设计 tokens + 队友 Iris/Lumi/Vita/Nova/Sera + 清理孤儿 + 家庭 profile 数据模型 + 还原家庭群剧本 | ✅ 已完成并入库 (`3483560`) |
| **Day 2** | ② 真整理相册（Gemini vision → Memory，产出观察）+ ③ reminder→视频回执闭环对接 | ⏳ 下一步 |
| **Day 3** | ① Home agent 洞察卡 + Today 确认队列成型 + 官网三场景脚本化 + 视觉打磨 + 截图 | ⏳ |

---

## 11. 暂不做 / 未来

- 拍传单/邮件 → 日程（原 Task B）。
- 真 Google/Apple 日历 OAuth 读写（先 stretch 的 "Connect" 入口）。
- Lumi 读书机器人的真 AI（仍在打磨，demo 内给 recap 卡，标 beta）。
- 原生 App（Expo / React Native）——长期方向，复用本 web 的类型/agent/设计 tokens。
