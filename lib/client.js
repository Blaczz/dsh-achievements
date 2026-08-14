window.__ModuleLoader__.load({
	id: "dsh-achievements",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		const ACHIEVEMENTS_STATE_API_PATH = `/plugins/dsh-achievements/api/state`;
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
		//#endregion
		//#region src/client/badge-panel.tsx
		/**
		* BadgePanel: the achievements settings page, registered into the
		* `settings.section` slot. Renders a lifetime counter summary plus the full
		* achievement grid (unlocked = colored, locked = dimmed).
		*/
		/** 'X 天前' / '刚刚' from an unlock epoch. */
		function elapsedLabel(unlockedAt, now = Date.now()) {
			if (unlockedAt === void 0) return "";
			const days = Math.floor((now - unlockedAt) / 864e5);
			if (days <= 0) return "刚刚";
			if (days === 1) return "1 天前";
			return `${days} 天前`;
		}
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
				key: "streakDays",
				label: "连续天数"
			}
		];
		/** The settings page body. */
		function BadgePanel({ achievements }) {
			const [snap, setSnap] = (0, react.useState)(achievements.getSnapshot());
			(0, react.useEffect)(() => achievements.subscribe(() => setSnap(achievements.getSnapshot())), [achievements]);
			if (snap === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					padding: 12,
					fontSize: 13,
					opacity: .7
				},
				children: "加载中…"
			});
			const { achievements: defs, state } = snap;
			const unlockedCount = Object.keys(state.unlocked).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					maxWidth: 640,
					padding: "4px 0 16px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "flex",
							gap: 10,
							paddingBottom: 12
						},
						children: STAT_ROWS.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								flex: 1,
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
								children: state.counters[row.key]
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
							fontSize: 13,
							fontWeight: 700,
							paddingBottom: 8
						},
						children: [
							"🏆 成就（",
							unlockedCount,
							"/",
							defs.length,
							"）"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
							gap: 8
						},
						children: defs.map((def) => {
							const unlockedAt = state.unlocked[def.id];
							const unlocked = unlockedAt !== void 0;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 10,
									alignItems: "center",
									borderRadius: 10,
									padding: 10,
									border: "1px solid rgba(128,128,128,0.18)",
									background: unlocked ? "rgba(77,107,254,0.10)" : "transparent",
									opacity: unlocked ? 1 : .55
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 24,
											flex: "none"
										},
										children: unlocked ? def.icon : "🔒"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											flex: 1,
											minWidth: 0
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											style: {
												fontSize: 13,
												fontWeight: 600
											},
											children: def.title.zh
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											style: {
												fontSize: 11,
												opacity: .7
											},
											children: def.description.zh
										})]
									}),
									unlocked && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 11,
											flex: "none",
											opacity: .7
										},
										children: elapsedLabel(unlockedAt)
									})
								]
							}, def.id);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 11,
							opacity: .55,
							paddingTop: 12
						},
						children: "成就状态跨会话持久化，保存在 DSH 主目录。回合、工具调用、会话数与连续天数自动累计。"
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
			const el = document.createElement("div");
			el.setAttribute("data-achievement-toast", "");
			const style = el.style;
			style.position = "fixed";
			style.right = "20px";
			style.bottom = "20px";
			style.zIndex = "2147483000";
			style.maxWidth = "320px";
			style.padding = "12px 16px";
			style.borderRadius = "12px";
			style.boxShadow = "0 8px 30px rgba(0,0,0,0.25)";
			style.background = "rgba(30,32,40,0.96)";
			style.color = "#fff";
			style.fontFamily = "system-ui, -apple-system, sans-serif";
			style.display = "flex";
			style.gap = "12px";
			style.alignItems = "center";
			style.animation = "dsh-achievement-slide 220ms ease-out";
			const icon = document.createElement("div");
			icon.textContent = item.achievement.icon;
			icon.style.fontSize = "28px";
			const body = document.createElement("div");
			body.style.flex = "1";
			const title = document.createElement("div");
			title.textContent = `🏆 成就解锁 · ${item.achievement.title.zh}`;
			title.style.fontWeight = "700";
			title.style.fontSize = "14px";
			const desc = document.createElement("div");
			desc.textContent = item.achievement.description.zh + (item.elapsed === null ? "" : ` · ${item.elapsed}`);
			desc.style.fontSize = "12px";
			desc.style.opacity = "0.8";
			desc.style.marginTop = "2px";
			body.appendChild(title);
			body.appendChild(desc);
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
			let lastUnlocked = /* @__PURE__ */ new Set();
			const checkUnlocks = () => {
				const snap = client.getSnapshot();
				if (snap === null || !snap.settings.enabled || !snap.settings.toastEnabled) return;
				const current = new Set(Object.keys(snap.state.unlocked));
				const fresh = [...current].filter((id) => !lastUnlocked.has(id));
				if (fresh.length > 0) for (const id of fresh) {
					const def = snap.achievements.find((achievement) => achievement.id === id);
					if (def !== void 0) showUnlockToast(def, elapsedOf(snap.state.unlocked[id]));
				}
				lastUnlocked = current;
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
				return () => {
					window.removeEventListener("focus", onFocus);
					document.removeEventListener("visibilitychange", onVisible);
					window.clearInterval(timer);
					client.dispose();
				};
			}, "achievements: poll");
			ctx.provide("achievements", {
				refresh,
				unlockedIds: () => [...lastUnlocked]
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
