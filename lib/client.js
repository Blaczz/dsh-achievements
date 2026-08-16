window.__ModuleLoader__.load({
	id: "dsh-achievements",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/api.ts
		/** Shared API path constants (no @deepseek-ai imports — safe to bundle client-side). */
		const ACHIEVEMENTS_API_PREFIX = "/plugins/dsh-achievements/api";
		const ACHIEVEMENTS_STATE_API_PATH = `${ACHIEVEMENTS_API_PREFIX}/state`;
		/** Server-sent-events endpoint: the Host pushes unlock notifications here. */
		const ACHIEVEMENTS_EVENTS_API_PATH = `${ACHIEVEMENTS_API_PREFIX}/events`;
		//#endregion
		//#region src/client/achievements-client.ts
		var HttpAchievementsClient = class {
			snapshot = null;
			listeners = /* @__PURE__ */ new Set();
			abort = new AbortController();
			disposed = false;
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			async refresh() {
				if (this.disposed) return;
				try {
					const response = await fetch(ACHIEVEMENTS_STATE_API_PATH, { signal: this.abort.signal });
					const body = await response.json();
					if (!response.ok) throw new Error(`achievements API answered ${response.status}`);
					this.snapshot = body;
					for (const listener of [...this.listeners]) listener();
				} catch (error) {
					if (this.abort.signal.aborted) return;
					throw error;
				}
			}
			dispose() {
				this.disposed = true;
				this.abort.abort();
				this.listeners.clear();
			}
		};
		/** Cumulative XP required to reach `level` (level 1 = 0 XP). */
		function xpForLevel(level) {
			return 100 * (level - 1) * level / 2;
		}
		/** Deterministic level + within-level progress for a total XP. */
		function levelOf(xp) {
			let level = 1;
			while (xpForLevel(level + 1) <= xp) level += 1;
			const current = xp - xpForLevel(level);
			const next = 100 * level;
			return {
				level,
				current,
				next,
				progress: Math.min(1, current / next)
			};
		}
		/** Common → legendary visual hierarchy (readable on light and dark themes). */
		const RARITY_META = {
			common: {
				label: {
					zh: "普通",
					en: "Common"
				},
				color: "#9ca3af"
			},
			uncommon: {
				label: {
					zh: "罕见",
					en: "Uncommon"
				},
				color: "#34d399"
			},
			rare: {
				label: {
					zh: "稀有",
					en: "Rare"
				},
				color: "#60a5fa"
			},
			epic: {
				label: {
					zh: "史诗",
					en: "Epic"
				},
				color: "#c084fc"
			},
			legendary: {
				label: {
					zh: "传说",
					en: "Legendary"
				},
				color: "#fbbf24"
			}
		};
		//#endregion
		//#region src/profile.ts
		/**
		* Agent Profile + Session Summary derivations. Browser-safe pure functions —
		* only type imports from state/achievements and the pure `levelOf` from
		* gamification — so the client bundle inlines them without pulling in node
		* or @deepseek-ai runtime code.
		*/
		const PERFECTIONIST = {
			id: "perfectionist",
			title: {
				zh: "完美主义",
				en: "Perfectionist"
			},
			description: {
				zh: "反复打磨同一个文件",
				en: "Polishes the same file repeatedly"
			}
		};
		const DETECTIVE = {
			id: "detective",
			title: {
				zh: "侦探",
				en: "Detective"
			},
			description: {
				zh: "读得多、改得少",
				en: "Reads a lot, edits little"
			}
		};
		const COWBOY = {
			id: "cowboy",
			title: {
				zh: "牛仔",
				en: "Cowboy"
			},
			description: {
				zh: "改得多、测试靠后",
				en: "Edits a lot, tests late"
			}
		};
		const TEST_DRIVEN = {
			id: "test-driven",
			title: {
				zh: "测试驱动",
				en: "Test-Driven"
			},
			description: {
				zh: "测试频繁、修改克制",
				en: "Tests often, edits carefully"
			}
		};
		const EXPLORER = {
			id: "explorer",
			title: {
				zh: "探索者",
				en: "Explorer"
			},
			description: {
				zh: "刚开始探索",
				en: "Just getting started"
			}
		};
		/** Deterministic persona from one session's behavior. Priority: first match wins. */
		function personaOf(session) {
			if (session === void 0) return EXPLORER;
			const reads = distinctCount(session.filesRead);
			const edits = distinctCount(session.filesEdited);
			const maxSameEdit = maxValue(session.filesEdited);
			const tests = session.tests.runs;
			const editsBeforeTest = session.editsBeforeFirstTest;
			if (maxSameEdit >= 4) return PERFECTIONIST;
			if (reads >= 10 && reads >= edits * 4) return DETECTIVE;
			if (edits >= 6 && editsBeforeTest >= 5) return COWBOY;
			if (tests >= 4 && edits <= tests) return TEST_DRIVEN;
			return EXPLORER;
		}
		function raritySummaryOf(views, unlocked) {
			const out = {
				common: {
					unlocked: 0,
					total: 0
				},
				uncommon: {
					unlocked: 0,
					total: 0
				},
				rare: {
					unlocked: 0,
					total: 0
				},
				epic: {
					unlocked: 0,
					total: 0
				},
				legendary: {
					unlocked: 0,
					total: 0
				}
			};
			for (const view of views) {
				out[view.rarity].total += 1;
				if (unlocked[view.id] !== void 0) out[view.rarity].unlocked += 1;
			}
			return out;
		}
		function favoriteToolOf(profile) {
			let best = null;
			let bestCount = 0;
			for (const [name, count] of Object.entries(profile.toolsByName)) if (count > bestCount) {
				best = name;
				bestCount = count;
			}
			return best;
		}
		/** Assemble the Agent Profile from raw state + views (persona uses the latest session). */
		function buildProfileView(state, views) {
			const sessionIds = Object.keys(state.sessions);
			const lastId = sessionIds[sessionIds.length - 1];
			const recent = lastId === void 0 ? void 0 : state.sessions[lastId];
			return {
				level: levelOf(state.profile.xp),
				xp: state.profile.xp,
				unlockedCount: Object.keys(state.profile.unlocked).length,
				totalCount: views.length,
				rarity: raritySummaryOf(views, state.profile.unlocked),
				favoriteTool: favoriteToolOf(state.profile),
				persona: personaOf(recent)
			};
		}
		/** Compute one session's report; null when the session bucket is absent. */
		function buildSessionSummary(state, sessionId) {
			const session = state.sessions[sessionId];
			if (session === void 0) return null;
			const before = levelOf(state.profile.xp - session.xpGained).level;
			const after = levelOf(state.profile.xp).level;
			return {
				sessionId,
				turns: session.trajectoryTurns,
				steps: session.steps,
				maxStepsInTurn: session.maxStepsInTurn,
				toolCalls: session.toolCalls,
				filesRead: distinctCount(session.filesRead),
				filesEdited: distinctCount(session.filesEdited),
				tests: session.tests.runs,
				failures: session.tests.failed,
				unlocked: [...session.unlocked],
				xpGained: session.xpGained,
				levelUp: after > before ? {
					from: before,
					to: after
				} : null
			};
		}
		function distinctCount(map) {
			return Object.keys(map).length;
		}
		function maxValue(map) {
			let max = 0;
			for (const value of Object.values(map)) if (value > max) max = value;
			return max;
		}
		//#endregion
		//#region src/share.ts
		/**
		* Sharing + community layer (v1.0): shareable achievement cards, a local
		* "Agent Wrapped" summary, and achievement chains. Everything here is
		* browser-safe and pure, and every export is privacy-safe by construction —
		* it only reads aggregate counters, achievement metadata, and persona/level;
		* it never reads file paths, command strings, or any session detail.
		*/
		function buildAchievementCard(view, unlockedAt) {
			return {
				id: view.id,
				icon: view.icon,
				title: view.title,
				description: view.description,
				rarity: view.rarity,
				xp: view.xp,
				unlockedAt
			};
		}
		function buildAgentWrapped(state, views) {
			const profile = buildProfileView(state, views);
			let topUnlock = null;
			let recentUnlock = null;
			for (const view of views) {
				const at = state.profile.unlocked[view.id];
				if (at === void 0) continue;
				const card = buildAchievementCard(view, at);
				if (topUnlock === null || RARITY_RANK[card.rarity] > RARITY_RANK[topUnlock.rarity]) topUnlock = card;
				if (recentUnlock === null || at > recentUnlock.unlockedAt) recentUnlock = card;
			}
			return {
				persona: profile.persona,
				level: profile.level,
				xp: profile.xp,
				unlockedCount: profile.unlockedCount,
				totalCount: profile.totalCount,
				turns: state.profile.turns,
				toolCalls: state.profile.toolCalls,
				sessions: state.profile.sessions,
				longestStreak: state.profile.longestStreak,
				favoriteTool: profile.favoriteTool,
				topUnlock,
				recentUnlock
			};
		}
		const RARITY_RANK = {
			common: 0,
			uncommon: 1,
			rare: 2,
			epic: 3,
			legendary: 4
		};
		function buildShareText(state, views, locale = "zh") {
			const profile = buildProfileView(state, views);
			const lines = [`🏆 dsh-achievements · ${profile.persona.title[locale]}`, `Lv.${profile.level.level} · ${profile.xp} XP · ${profile.unlockedCount}/${profile.totalCount} 成就`];
			const unlocked = views.filter((view) => state.profile.unlocked[view.id] !== void 0).sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || a.id.localeCompare(b.id));
			if (unlocked.length > 0) {
				lines.push("");
				for (const view of unlocked) lines.push(`${view.icon} ${view.title[locale]} · ${RARITY_META[view.rarity].label[locale]}`);
			}
			return lines.join("\n");
		}
		/**
		* The seven formal five-tier Lifetime progression chains. Each has exactly five
		* nodes ordered common → uncommon → rare → epic → legendary (see Task 17), and
		* drives the Badge Wall's milestone grouping — the UI derives milestone ids from
		* these chains rather than hardcoding them.
		*/
		const MILESTONE_CHAINS = [
			{
				id: "turns",
				title: {
					zh: "回合之路",
					en: "Turn Road"
				},
				achievementIds: [
					"first-turn",
					"turns-25",
					"turns-50",
					"hundred-turns",
					"turns-500"
				]
			},
			{
				id: "tools",
				title: {
					zh: "工具之途",
					en: "Tool Path"
				},
				achievementIds: [
					"first-tool",
					"tools-25",
					"hundred-tools",
					"tools-500",
					"tools-2000"
				]
			},
			{
				id: "sessions",
				title: {
					zh: "会话旅程",
					en: "Session Journey"
				},
				achievementIds: [
					"sessions-1",
					"ten-sessions",
					"sessions-50",
					"sessions-200",
					"sessions-500"
				]
			},
			{
				id: "active-days",
				title: {
					zh: "活跃岁月",
					en: "Active Days"
				},
				achievementIds: [
					"active-days-1",
					"active-days-7",
					"active-days-30",
					"active-days-100",
					"active-days-365"
				]
			},
			{
				id: "file-reads",
				title: {
					zh: "阅读之路",
					en: "File Reads"
				},
				achievementIds: [
					"file-reads-10",
					"file-reads-100",
					"file-reads-500",
					"file-reads-2500",
					"file-reads-10000"
				]
			},
			{
				id: "file-edits",
				title: {
					zh: "编辑之路",
					en: "File Edits"
				},
				achievementIds: [
					"file-edits-1",
					"file-edits-10",
					"file-edits-50",
					"file-edits-250",
					"file-edits-1000"
				]
			},
			{
				id: "tests",
				title: {
					zh: "测试之路",
					en: "Test Runs"
				},
				achievementIds: [
					"tests-1",
					"tests-10",
					"tests-50",
					"tests-250",
					"tests-1000"
				]
			}
		];
		/**
		* P7 trajectory chains: four five-tier session chains. The Badge Wall derives
		* its special-behavior grouping from these ids (never hardcoded in JSX), and
		* each chain also renders as a `/5` progress row.
		*/
		const TRAJECTORY_CHAINS = [
			{
				id: "session-marathon",
				title: {
					zh: "会话马拉松",
					en: "Session Marathon"
				},
				achievementIds: [
					"session-turns-5",
					"session-turns-20",
					"session-turns-50",
					"session-turns-100",
					"session-turns-200"
				]
			},
			{
				id: "turn-depth",
				title: {
					zh: "单轮深潜",
					en: "Turn Depth"
				},
				achievementIds: [
					"turn-steps-5",
					"turn-steps-20",
					"turn-steps-50",
					"turn-steps-100",
					"turn-steps-500"
				]
			},
			{
				id: "tool-barrage",
				title: {
					zh: "工具齐射",
					en: "Tool Barrage"
				},
				achievementIds: [
					"step-tools-5",
					"step-tools-10",
					"step-tools-25",
					"step-tools-50",
					"step-tools-100"
				]
			},
			{
				id: "time-anomaly",
				title: {
					zh: "时间异象",
					en: "Time Anomaly"
				},
				achievementIds: [
					"request-duration-30s",
					"request-duration-100s",
					"request-duration-300s",
					"request-duration-500s",
					"request-duration-1000s"
				]
			}
		];
		/** Non-progression special chains: streaks + session behavior + P7 trajectory. */
		const SPECIAL_CHAINS = [
			{
				id: "streaks",
				title: {
					zh: "连续作战",
					en: "Streak"
				},
				achievementIds: ["streak-3", "streak-7"]
			},
			{
				id: "behavior",
				title: {
					zh: "行为狂人",
					en: "Behavior Maniac"
				},
				achievementIds: [
					"deja-vu",
					"rabbit-hole",
					"yolo",
					"it-works-eventually"
				]
			},
			...TRAJECTORY_CHAINS
		];
		[...MILESTONE_CHAINS, ...SPECIAL_CHAINS];
		//#endregion
		//#region src/client/badge-panel-model.ts
		/**
		* Chains that render a progress bar in the group header: the seven five-tier
		* milestone routes plus the four five-tier trajectory chains. The two-node
		* streaks and four-node behavior special chains stay count-only.
		*/
		const PROGRESSION_CHAIN_IDS = new Set([...MILESTONE_CHAINS, ...TRAJECTORY_CHAINS].map((chain) => chain.id));
		/** Whether a card is visible under the given status filter. */
		function matchesAchievementStatus(unlockedAt, filter) {
			if (filter === "locked") return unlockedAt === void 0;
			if (filter === "unlocked") return unlockedAt !== void 0;
			return true;
		}
		/** Resolve a chain's ids to views, keeping the chain's declaration order. */
		function resolveDefs(ids, defs) {
			return ids.map((id) => defs.find((def) => def.id === id)).filter((def) => def !== void 0);
		}
		function completedOf(defs, unlocked) {
			return defs.reduce((n, def) => n + (unlocked[def.id] !== void 0 ? 1 : 0), 0);
		}
		/** The seven lifetime milestone chains, one collapsible group each. */
		function buildMilestoneGroups(defs, unlocked) {
			return MILESTONE_CHAINS.map((chain) => {
				const groupDefs = resolveDefs(chain.achievementIds, defs);
				return {
					id: chain.id,
					title: chain.title,
					defs: groupDefs,
					chain,
					progression: true,
					completed: completedOf(groupDefs, unlocked),
					total: groupDefs.length
				};
			});
		}
		/**
		* Special achievements grouped by `SPECIAL_CHAINS`, plus one residual group
		* holding every def that belongs to neither a milestone chain nor a special
		* chain: the early `ten-turns` bonus, the remaining classic behavior
		* achievements, and any third-party pack achievements.
		*/
		function buildSpecialGroups(defs, unlocked) {
			const milestoneIds = new Set(MILESTONE_CHAINS.flatMap((chain) => chain.achievementIds));
			const specialChainIds = new Set(SPECIAL_CHAINS.flatMap((chain) => chain.achievementIds));
			const residualDefs = defs.filter((def) => !milestoneIds.has(def.id) && !specialChainIds.has(def.id));
			const groups = SPECIAL_CHAINS.map((chain) => {
				const groupDefs = resolveDefs(chain.achievementIds, defs);
				return {
					id: chain.id,
					title: chain.title,
					defs: groupDefs,
					chain,
					progression: PROGRESSION_CHAIN_IDS.has(chain.id),
					completed: completedOf(groupDefs, unlocked),
					total: groupDefs.length
				};
			});
			if (residualDefs.length > 0) groups.unshift({
				id: "residual-special",
				title: {
					zh: "其它 / 经典行为",
					en: "Other / Classic"
				},
				defs: residualDefs,
				chain: null,
				progression: false,
				completed: completedOf(residualDefs, unlocked),
				total: residualDefs.length
			});
			return groups;
		}
		//#endregion
		//#region src/client/badge-panel.tsx
		/**
		* BadgePanel: the achievements settings page, registered into the
		* `settings.section` slot. Renders the Agent Profile (level, XP, persona,
		* rarity distribution, favorite tool), the seven lifetime counters + a
		* separate streak line, a collapsible badge wall grouped by the seven
		* milestone routes and the special chains, and the latest session report.
		*
		* Task 22 keeps this a lightweight settings page: the 68 cards are collapsed
		* behind per-route `<details>` groups, a single status filter narrows the
		* visible cards, and the low-frequency Wrapped / Share blocks start closed.
		*/
		/** 'X 天前' / '刚刚' from an unlock epoch. */
		function elapsedLabel(unlockedAt, now = Date.now()) {
			if (unlockedAt === void 0) return "";
			const days = Math.floor((now - unlockedAt) / 864e5);
			if (days <= 0) return "刚刚";
			if (days === 1) return "1 天前";
			return `${days} 天前`;
		}
		/** Seven lifetime progression metrics; streak is shown separately. */
		const STAT_ROWS = [
			{
				key: "turns",
				label: "回合"
			},
			{
				key: "toolCalls",
				label: "工具调用"
			},
			{
				key: "sessions",
				label: "会话"
			},
			{
				key: "activeDays",
				label: "活跃天数"
			},
			{
				key: "fileReads",
				label: "读取次数"
			},
			{
				key: "fileEdits",
				label: "修改次数"
			},
			{
				key: "testRuns",
				label: "测试"
			}
		];
		const RARITY_ORDER = [
			"common",
			"uncommon",
			"rare",
			"epic",
			"legendary"
		];
		const REPORT_ROWS = [
			{
				key: "turns",
				label: "回合"
			},
			{
				key: "steps",
				label: "步骤"
			},
			{
				key: "maxStepsInTurn",
				label: "最深单轮"
			},
			{
				key: "toolCalls",
				label: "工具调用"
			},
			{
				key: "filesRead",
				label: "读文件"
			},
			{
				key: "filesEdited",
				label: "改文件"
			},
			{
				key: "tests",
				label: "测试"
			},
			{
				key: "failures",
				label: "失败"
			}
		];
		/** Inject the disclosure caret CSS once (no React state, no animation). */
		let disclosureCssInjected = false;
		function ensureDisclosureCss() {
			if (disclosureCssInjected) return;
			disclosureCssInjected = true;
			const style = document.createElement("style");
			style.textContent = [
				".dsh-badge-group summary { list-style: none; }",
				".dsh-badge-group summary::-webkit-details-marker { display: none; }",
				".dsh-badge-group summary::marker { content: \"\"; }",
				".dsh-badge-group .dsh-badge-caret::before { content: '▸'; }",
				".dsh-badge-group[open] .dsh-badge-caret::before { content: '▾'; }"
			].join("\n");
			document.head.appendChild(style);
		}
		/** Unified section shell: border, radius, padding and optional title. */
		function SectionPanel({ title, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: {
					borderRadius: 12,
					border: "1px solid rgba(128,128,128,0.18)",
					padding: 12,
					marginBottom: 12
				},
				children: [title !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						fontSize: 13,
						fontWeight: 700,
						paddingBottom: 8
					},
					children: title
				}), children]
			});
		}
		/** One achievement card; reused across every collapsible group. */
		function AchievementCard({ def, unlockedAt, progress }) {
			const unlocked = unlockedAt !== void 0;
			const rarity = RARITY_META[def.rarity];
			if (def.hidden === true && !unlocked) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					gap: 10,
					alignItems: "center",
					borderRadius: 10,
					padding: 10,
					border: "1px solid rgba(128,128,128,0.18)",
					opacity: .55
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						fontSize: 24,
						flex: "none"
					},
					children: "🔒"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						flex: 1,
						minWidth: 0
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 13,
							fontWeight: 600
						},
						children: "???"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 11,
							opacity: .7
						},
						children: "未解锁的隐藏成就"
					})]
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					gap: 10,
					alignItems: "flex-start",
					borderRadius: 10,
					padding: 10,
					border: `1px solid ${unlocked ? rarity.color : "rgba(128,128,128,0.18)"}`,
					background: unlocked ? `${rarity.color}1a` : "transparent",
					opacity: unlocked ? 1 : .6
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						fontSize: 24,
						flex: "none",
						lineHeight: 1.3
					},
					children: unlocked ? def.icon : "🔒"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						flex: 1,
						minWidth: 0
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 6,
								alignItems: "baseline",
								flexWrap: "wrap"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: 13,
									fontWeight: 600
								},
								children: def.title.zh
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: 10,
									color: rarity.color,
									whiteSpace: "nowrap"
								},
								children: rarity.label.zh
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 11,
								opacity: .7
							},
							children: def.description.zh
						}),
						unlocked && def.flavorText !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 11,
								opacity: .55,
								fontStyle: "italic",
								paddingTop: 2
							},
							children: def.flavorText.zh
						}),
						!unlocked && progress?.target !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8,
								paddingTop: 6
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									flex: 1,
									height: 5,
									borderRadius: 3,
									background: "rgba(128,128,128,0.15)",
									overflow: "hidden"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
									width: `${Math.min(100, Math.round((progress.progress ?? 0) / progress.target * 100))}%`,
									height: "100%",
									background: rarity.color,
									borderRadius: 3
								} })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									fontSize: 10,
									opacity: .7,
									whiteSpace: "nowrap",
									fontVariantNumeric: "tabular-nums"
								},
								children: [
									progress.progress ?? 0,
									"/",
									progress.target
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "baseline",
								gap: 8,
								paddingTop: 4
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									fontSize: 10,
									color: rarity.color,
									flex: 1
								},
								children: [
									"+",
									def.xp,
									" XP"
								]
							}), unlocked && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: 11,
									opacity: .7,
									flex: "none"
								},
								children: elapsedLabel(unlockedAt)
							})]
						})
					]
				})]
			});
		}
		/** A collapsible route/special group: header carries title + progress, cards inside. */
		function AchievementGroup({ group, unlocked, progress, filter }) {
			const visible = group.defs.filter((def) => matchesAchievementStatus(unlocked[def.id], filter));
			if (visible.length === 0) return null;
			const done = group.completed === group.total;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "dsh-badge-group",
				style: {
					border: "1px solid rgba(128,128,128,0.18)",
					borderRadius: 10,
					padding: "8px 10px",
					marginBottom: 8
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
					style: {
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						gap: 8
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-badge-caret",
							style: {
								fontSize: 11,
								opacity: .6,
								flex: "none"
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								flex: 1,
								minWidth: 0,
								fontSize: 12,
								fontWeight: 600
							},
							children: group.title.zh
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: {
								fontSize: 11,
								opacity: .7,
								flex: "none",
								fontVariantNumeric: "tabular-nums"
							},
							children: [
								group.completed,
								"/",
								group.total
							]
						}),
						group.progression && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								width: 80,
								height: 6,
								borderRadius: 3,
								background: "rgba(128,128,128,0.15)",
								overflow: "hidden",
								flex: "none"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
								width: `${group.total === 0 ? 0 : Math.round(group.completed / group.total * 100)}%`,
								height: "100%",
								background: done ? "#34d399" : "#fbbf24",
								borderRadius: 3
							} })
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
						gap: 8,
						paddingTop: 8
					},
					children: visible.map((def) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AchievementCard, {
						def,
						unlockedAt: unlocked[def.id],
						progress: progress[def.id]
					}, def.id))
				})]
			});
		}
		/** The settings page body. */
		function BadgePanel({ achievements }) {
			const [snap, setSnap] = (0, react.useState)(achievements.getSnapshot());
			const [copied, setCopied] = (0, react.useState)(false);
			const [filter, setFilter] = (0, react.useState)("all");
			(0, react.useEffect)(() => achievements.subscribe(() => setSnap(achievements.getSnapshot())), [achievements]);
			(0, react.useEffect)(() => {
				ensureDisclosureCss();
			}, []);
			if (snap === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					padding: 12,
					fontSize: 13,
					opacity: .7
				},
				children: "加载中…"
			});
			const { achievements: defs, state } = snap;
			const profile = buildProfileView(state, defs);
			const sessionIds = Object.keys(state.sessions);
			const lastSessionId = sessionIds[sessionIds.length - 1];
			const summary = lastSessionId === void 0 ? null : buildSessionSummary(state, lastSessionId);
			const wrapped = buildAgentWrapped(state, defs);
			const shareText = buildShareText(state, defs);
			const milestoneGroups = buildMilestoneGroups(defs, state.profile.unlocked);
			const specialGroups = buildSpecialGroups(defs, state.profile.unlocked);
			const copyShare = () => {
				if (navigator.clipboard === void 0) return;
				navigator.clipboard.writeText(shareText).then(() => {
					setCopied(true);
					window.setTimeout(() => setCopied(false), 1500);
				}).catch(() => {});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					maxWidth: 680,
					padding: "4px 0 16px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SectionPanel, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 10,
								paddingBottom: 10
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									flex: 1,
									minWidth: 0
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 17,
										fontWeight: 800
									},
									children: profile.persona.title.zh
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 12,
										opacity: .7
									},
									children: profile.persona.description.zh
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									fontSize: 22,
									fontWeight: 800,
									flex: "none"
								},
								children: ["Lv.", profile.level.level]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 10,
								paddingBottom: 12
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									flex: 1,
									height: 8,
									borderRadius: 4,
									background: "rgba(128,128,128,0.15)",
									overflow: "hidden"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
									width: `${Math.round(profile.level.progress * 100)}%`,
									height: "100%",
									background: "#fbbf24",
									borderRadius: 4
								} })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									fontSize: 12,
									opacity: .7,
									flex: "none"
								},
								children: [
									profile.level.current,
									"/",
									profile.level.next,
									" XP"
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexWrap: "wrap",
								gap: 8,
								paddingBottom: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									fontSize: 12,
									opacity: .8
								},
								children: [
									"已解锁 ",
									profile.unlockedCount,
									"/",
									profile.totalCount
								]
							}), profile.favoriteTool !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									fontSize: 12,
									opacity: .8
								},
								children: ["常用工具 · ", profile.favoriteTool]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								display: "flex",
								flexWrap: "wrap",
								gap: 6,
								paddingBottom: 12
							},
							children: RARITY_ORDER.map((rarity) => {
								const meta = RARITY_META[rarity];
								const count = profile.rarity[rarity];
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 11,
										color: meta.color,
										border: `1px solid ${meta.color}`,
										borderRadius: 6,
										padding: "2px 6px",
										opacity: count.total === 0 ? .45 : 1
									},
									children: [
										meta.label.zh,
										" ",
										count.unlocked,
										"/",
										count.total
									]
								}, rarity);
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(78px, 1fr))",
								gap: 8,
								paddingBottom: 10
							},
							children: STAT_ROWS.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									textAlign: "center",
									borderRadius: 10,
									padding: "10px 6px",
									background: "rgba(128,128,128,0.08)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 20,
										fontWeight: 700
									},
									children: state.profile[row.key]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 11,
										opacity: .7
									},
									children: row.label
								})]
							}, row.key))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								fontSize: 12,
								opacity: .8
							},
							children: [
								"🔥 当前连续 ",
								state.profile.currentStreak,
								" 天 · 最长连续 ",
								state.profile.longestStreak,
								" 天"
							]
						})
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "4px 0 8px"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								fontSize: 13,
								fontWeight: 700,
								flex: 1
							},
							children: [
								"🏆 成就（",
								profile.unlockedCount,
								"/",
								defs.length,
								"）"
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 6,
								fontSize: 12,
								opacity: .7
							},
							children: ["显示", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: filter,
								onChange: (event) => setFilter(event.target.value),
								style: {
									fontSize: 12,
									padding: "3px 6px",
									borderRadius: 6,
									border: "1px solid rgba(128,128,128,0.3)",
									background: "transparent",
									color: "inherit"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "all",
										children: "全部"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "locked",
										children: "未解锁"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "unlocked",
										children: "已解锁"
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							fontWeight: 600,
							opacity: .75,
							paddingBottom: 6
						},
						children: "成长里程碑"
					}),
					milestoneGroups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AchievementGroup, {
						group,
						unlocked: state.profile.unlocked,
						progress: snap.progress,
						filter
					}, group.id)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							fontWeight: 600,
							opacity: .75,
							padding: "4px 0 6px"
						},
						children: "特殊行为"
					}),
					specialGroups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AchievementGroup, {
						group,
						unlocked: state.profile.unlocked,
						progress: snap.progress,
						filter
					}, group.id)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionPanel, {
						title: "📋 最近会话战报",
						children: summary === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 12,
								opacity: .55
							},
							children: "暂无会话数据。"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									display: "flex",
									gap: 10,
									flexWrap: "wrap",
									paddingBottom: summary.unlocked.length > 0 || summary.xpGained > 0 ? 10 : 0
								},
								children: REPORT_ROWS.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										flex: "1 1 0",
										minWidth: 60,
										textAlign: "center",
										borderRadius: 8,
										padding: "8px 4px",
										background: "rgba(128,128,128,0.08)"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 18,
											fontWeight: 700
										},
										children: summary[row.key]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 11,
											opacity: .7
										},
										children: row.label
									})]
								}, row.key))
							}),
							summary.unlocked.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									fontSize: 12,
									paddingBottom: 4
								},
								children: ["本会话解锁：", summary.unlocked.map((id) => {
									const def = defs.find((d) => d.id === id);
									return def === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: { marginRight: 8 },
										children: [
											def.icon,
											" ",
											def.title.zh
										]
									}, id);
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									fontSize: 12,
									opacity: .8
								},
								children: [summary.xpGained > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										marginRight: 12,
										color: "#fbbf24"
									},
									children: [
										"+",
										summary.xpGained,
										" XP"
									]
								}), summary.levelUp !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontWeight: 700,
										color: "#fbbf24"
									},
									children: [
										"🎉 升级 Lv.",
										summary.levelUp.from,
										" → Lv.",
										summary.levelUp.to
									]
								})]
							})
						] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "dsh-badge-group",
						style: {
							border: "1px solid rgba(128,128,128,0.18)",
							borderRadius: 10,
							padding: "8px 10px",
							marginBottom: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
							style: {
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-badge-caret",
								style: {
									fontSize: 11,
									opacity: .6,
									flex: "none"
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									flex: 1,
									fontSize: 13,
									fontWeight: 700
								},
								children: "🎁 Agent Wrapped"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								paddingTop: 8,
								display: "flex",
								flexWrap: "wrap",
								gap: 8
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: { fontSize: 12 },
									children: [
										wrapped.persona.title.zh,
										" · Lv.",
										wrapped.level.level
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 12,
										opacity: .7
									},
									children: [wrapped.turns, " 回合"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 12,
										opacity: .7
									},
									children: [wrapped.toolCalls, " 工具"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 12,
										opacity: .7
									},
									children: [wrapped.sessions, " 会话"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 12,
										opacity: .7
									},
									children: [
										"最长连击 ",
										wrapped.longestStreak,
										" 天"
									]
								}),
								wrapped.favoriteTool !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 12,
										opacity: .7
									},
									children: ["常用 ", wrapped.favoriteTool]
								}),
								wrapped.topUnlock !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 12,
										opacity: .85
									},
									children: [
										"🏆 最高稀有成就：",
										wrapped.topUnlock.icon,
										" ",
										wrapped.topUnlock.title.zh
									]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "dsh-badge-group",
						style: {
							border: "1px solid rgba(128,128,128,0.18)",
							borderRadius: 10,
							padding: "8px 10px",
							marginBottom: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
							style: {
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-badge-caret",
								style: {
									fontSize: 11,
									opacity: .6,
									flex: "none"
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									flex: 1,
									fontSize: 13,
									fontWeight: 700
								},
								children: "📤 分享"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: { paddingTop: 8 },
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
									style: {
										margin: 0,
										fontSize: 11,
										whiteSpace: "pre-wrap",
										opacity: .85,
										maxHeight: 200,
										overflow: "auto"
									},
									children: shareText
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: copyShare,
									style: {
										marginTop: 8,
										padding: "6px 12px",
										fontSize: 12,
										borderRadius: 8,
										border: "1px solid rgba(128,128,128,0.3)",
										background: "transparent",
										color: "inherit",
										cursor: "pointer"
									},
									children: copied ? "已复制 ✓" : "复制分享文本"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 11,
										opacity: .55,
										paddingTop: 8
									},
									children: "成就状态跨会话持久化，保存在 DSH 主目录。分享内容仅含成就、等级与计数，不含文件路径或命令。"
								})
							]
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/toast.ts
		let activeToast = null;
		const queue = [];
		/** Show one unlock toast; multiple calls stack into a queue. */
		function showUnlockToast(achievement, elapsed) {
			queue.push({
				achievement,
				elapsed
			});
			drainQueue();
		}
		function drainQueue() {
			if (activeToast !== null || queue.length === 0) return;
			const item = queue.shift();
			if (item === void 0) return;
			activeToast = buildToast(item);
			document.body.appendChild(activeToast);
			const remove = () => {
				if (activeToast !== null) {
					activeToast.remove();
					activeToast = null;
				}
				if (queue.length > 0) window.setTimeout(drainQueue, 150);
			};
			window.setTimeout(remove, 4200);
		}
		function buildToast(item) {
			const { achievement, elapsed } = item;
			const rarity = RARITY_META[achievement.rarity];
			const el = document.createElement("div");
			el.setAttribute("data-achievement-toast", "");
			const style = el.style;
			style.position = "fixed";
			style.right = "16px";
			style.bottom = "16px";
			style.zIndex = "2147483000";
			style.width = "min(340px, calc(100vw - 32px))";
			style.padding = "12px 16px";
			style.borderRadius = "12px";
			style.boxShadow = "0 8px 30px rgba(0,0,0,0.25)";
			style.background = "rgba(30,32,40,0.96)";
			style.color = "#fff";
			style.fontFamily = "system-ui, -apple-system, sans-serif";
			style.display = "flex";
			style.gap = "12px";
			style.alignItems = "flex-start";
			style.borderLeft = `4px solid ${rarity.color}`;
			style.animation = "dsh-achievement-slide 220ms ease-out";
			const icon = document.createElement("div");
			icon.textContent = achievement.icon;
			icon.style.fontSize = "30px";
			icon.style.lineHeight = "1.2";
			const body = document.createElement("div");
			body.style.flex = "1";
			body.style.minWidth = "0";
			const eyebrow = document.createElement("div");
			eyebrow.textContent = `🏆 ${rarity.label.zh} · 成就解锁`;
			eyebrow.style.fontSize = "11px";
			eyebrow.style.fontWeight = "700";
			eyebrow.style.letterSpacing = "0.02em";
			eyebrow.style.color = rarity.color;
			const title = document.createElement("div");
			title.textContent = achievement.title.zh;
			title.style.fontWeight = "700";
			title.style.fontSize = "15px";
			title.style.marginTop = "2px";
			const desc = document.createElement("div");
			desc.textContent = achievement.description.zh + (elapsed === null ? "" : ` · ${elapsed}`);
			desc.style.fontSize = "12px";
			desc.style.opacity = "0.8";
			desc.style.marginTop = "2px";
			const footer = document.createElement("div");
			footer.style.display = "flex";
			footer.style.gap = "8px";
			footer.style.alignItems = "center";
			footer.style.marginTop = "6px";
			const xp = document.createElement("div");
			xp.textContent = `+${achievement.xp} XP`;
			xp.style.fontSize = "12px";
			xp.style.fontWeight = "700";
			xp.style.color = rarity.color;
			const flavor = document.createElement("div");
			flavor.style.fontSize = "11px";
			flavor.style.fontStyle = "italic";
			flavor.style.opacity = "0.55";
			flavor.style.flex = "1";
			flavor.style.minWidth = "0";
			flavor.style.overflow = "hidden";
			flavor.style.textOverflow = "ellipsis";
			flavor.style.whiteSpace = "nowrap";
			if (achievement.flavorText !== void 0) flavor.textContent = achievement.flavorText.zh;
			footer.appendChild(xp);
			footer.appendChild(flavor);
			body.appendChild(eyebrow);
			body.appendChild(title);
			body.appendChild(desc);
			body.appendChild(footer);
			el.appendChild(icon);
			el.appendChild(body);
			ensureKeyframes();
			return el;
		}
		/** Inject the slide-in keyframes once per document. */
		function ensureKeyframes() {
			if (document.getElementById("dsh-achievement-keyframes") !== null) return;
			const style = document.createElement("style");
			style.id = "dsh-achievement-keyframes";
			style.textContent = "@keyframes dsh-achievement-slide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }";
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/unlock-tracker.ts
		function createUnlockTracker() {
			let initialized = false;
			let lastUnlocked = /* @__PURE__ */ new Set();
			return {
				diff(ids) {
					const current = new Set(ids);
					if (!initialized) {
						lastUnlocked = current;
						initialized = true;
						return [];
					}
					const fresh = ids.filter((id) => !lastUnlocked.has(id));
					lastUnlocked = current;
					return fresh;
				},
				currentIds() {
					return [...lastUnlocked];
				}
			};
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services (cordis fiber inject). */
		const inject = ["slots"];
		/** 'X 天前' / '刚刚' from an unlock epoch. */
		function elapsedOf(ts, now = Date.now()) {
			if (ts === void 0) return null;
			const days = Math.floor((now - ts) / 864e5);
			if (days <= 0) return "刚刚";
			if (days === 1) return "1 天前";
			return `${days} 天前`;
		}
		/**
		* Client plugin body: one shared HTTP client, an unlock watcher that toasts
		* new achievements, the cross-plugin service, and the settings-page panel.
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			const client = new HttpAchievementsClient();
			const tracker = createUnlockTracker();
			const checkUnlocks = () => {
				const snap = client.getSnapshot();
				if (snap === null) return;
				const fresh = tracker.diff(Object.keys(snap.state.profile.unlocked));
				if (!snap.settings.enabled || !snap.settings.toastEnabled) return;
				for (const id of fresh) {
					const def = snap.achievements.find((achievement) => achievement.id === id);
					if (def !== void 0) showUnlockToast(def, elapsedOf(snap.state.profile.unlocked[id]));
				}
			};
			const refresh = () => {
				client.refresh().then(checkUnlocks).catch(() => {});
			};
			ctx.effect(() => {
				refresh();
				const onFocus = () => refresh();
				const onVisible = () => {
					if (!document.hidden) refresh();
				};
				window.addEventListener("focus", onFocus);
				document.addEventListener("visibilitychange", onVisible);
				const timer = window.setInterval(() => {
					if (!document.hidden) refresh();
				}, 3e4);
				const events = new EventSource(ACHIEVEMENTS_EVENTS_API_PATH);
				events.addEventListener("unlock", () => refresh());
				return () => {
					window.removeEventListener("focus", onFocus);
					document.removeEventListener("visibilitychange", onVisible);
					window.clearInterval(timer);
					events.close();
					client.dispose();
				};
			}, "achievements: poll");
			ctx.provide("achievementsState", {
				refresh,
				unlockedIds: () => tracker.currentIds()
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-achievements",
				order: 60,
				label: "🏆 成就",
				inject: () => ({ achievements: client })
			}, BadgePanel));
		}
		//#endregion
		exports.HttpAchievementsClient = HttpAchievementsClient;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
