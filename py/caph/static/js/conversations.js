class ConversationManager {
	constructor() {
		this.storageKey = "conversations";
		this.conversations = [];
		this.activeId = null;
		this.load();
		// render sidebar on init if DOM ready
		$(document).ready(() => {
			this.renderSidebar();
		});
	}

	load() {
		try {
			const raw = localStorage.getItem(this.storageKey);
			if (raw) {
				this.conversations = JSON.parse(raw);
			} else {
				// 初始化一个默认会话
				const conv = this._createDefaultConversation();
				this.conversations = [conv];
				this.activeId = conv.id;
				this.save();
			}
			if (!this.activeId && this.conversations.length) {
				this.activeId = this.conversations[0].id;
			}
		} catch (e) {
			console.error("加载会话失败:", e);
			this.conversations = [this._createDefaultConversation()];
			this.activeId = this.conversations[0].id;
			this.save();
		}
	}

	save() {
		localStorage.setItem(this.storageKey, JSON.stringify(this.conversations));
		this.renderSidebar();
	}

	_createDefaultConversation() {
		return {
			id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
			name: "新对话",
			messages: [],
			model: null,
			temperature: null,
			systemPrompt: null,
			createdAt: new Date().toISOString(),
		};
	}

	// 新增：生成唯一名称
	_generateUniqueName(base) {
		const exists = new Set(this.conversations.map((c) => c.name));
		if (!exists.has(base)) return base;
		let i = 1;
		while (exists.has(`${base} (${i})`)) i++;
		return `${base} (${i})`;
	}

	// 新增：检查名字是否存在（排除指定 id）
	_isNameExists(name, excludeId = null) {
		return this.conversations.some((c) => c.name === name && c.id !== excludeId);
	}

	getAll() {
		return this.conversations;
	}

	getActive() {
		return this.conversations.find((c) => c.id === this.activeId) || null;
	}

	// 修改：创建会话时确保名称唯一
	createConversation(name) {
		const conv = this._createDefaultConversation();
		if (name) {
			// 若传入名称，确保不重复
			if (this._isNameExists(name)) {
				name = this._generateUniqueName(name);
			}
			conv.name = name;
		} else {
			conv.name = this._generateUniqueName(conv.name);
		}
		this.conversations.unshift(conv);
		this.activeId = conv.id;
		this.save();
		this.triggerChange();
		return conv;
	}

	deleteConversation(id) {
		const idx = this.conversations.findIndex((c) => c.id === id);
		if (idx === -1) return;
		this.conversations.splice(idx, 1);
		if (this.activeId === id) {
			this.activeId = this.conversations.length ? this.conversations[0].id : null;
		}
		this.save();
		this.triggerChange();
	}

	renameConversation(id, newName) {
		const c = this.conversations.find((x) => x.id === id);
		if (!c) return;
		c.name = newName || c.name;
		this.save();
		this.renderSidebar();
	}

	setActive(id) {
		if (this.activeId === id) return;
		this.activeId = id;
		this.save(); // persist active selection
		this.triggerChange();
	}

	updateActiveMetadata(meta) {
		const c = this.getActive();
		if (!c) return;
		Object.assign(c, meta);
		this.save();
		// this.triggerChange();
	}

	updateActiveMessages(messages) {
		const c = this.getActive();
		if (!c) return;
		c.messages = messages;
		this.save();
	}

	exportActiveConversation() {
		const c = this.getActive();
		if (!c) return null;
		// 结构化导出
		const payload = {
			name: c.name,
			model: c.model,
			// temperature: c.temperature,
			// systemPrompt: c.systemPrompt,
			messages: c.messages,
			exportedAt: new Date().toISOString(),
			version: 1,
		};
		return payload;
	}

	importFromObject(obj) {
		if (!obj || !obj.messages) throw new Error("无效的会话文件");
		// 若名称冲突，追加序号
		let name = obj.name || "导入的对话";
		const exists = this.conversations.map((c) => c.name);
		if (exists.includes(name)) {
			let i = 1;
			while (exists.includes(name + " (" + i + ")")) i++;
			name = name + " (" + i + ")";
		}
		const conv = {
			id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
			name,
			messages: obj.messages || [],
			model: obj.model || null,
			createdAt: new Date().toISOString(),
		};
		this.conversations.unshift(conv);
		this.activeId = conv.id;
		this.save();
		// this.triggerChange();
		return conv;
	}

	importFromFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const obj = JSON.parse(e.target.result);
					const conv = this.importFromObject(obj);
					resolve(conv);
				} catch (err) {
					reject(err);
				}
			};
			reader.onerror = (e) => reject(e);
			reader.readAsText(file, "utf-8");
		});
	}

	downloadObjectAsJson(obj, filename) {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
		const a = document.createElement("a");
		a.setAttribute("href", dataStr);
		a.setAttribute("download", filename);
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	// 渲染侧栏列表（会话列表）
	renderSidebar() {
		const $container = $("#conversations-list");
		if ($container.length === 0) return;
		$container.empty();

		for (const conv of this.conversations) {
			const activeClass = this.activeId === conv.id ? "active" : "";
			const $item = $(`
				<div class="conv-item ${activeClass} a" data-conv-id="${conv.id}">
					<div class="name">${conv.name}</div>
					<div class="conv-actions">
						<button class="edit small-btn" title="重命名"><span class="sfi">&#xE70F;</span></button>
						<button class="del small-btn" title="删除"><span class="sfi">&#xE74D;</span></button>
					</div>
				</div>
			`);
			$item.click(() => {
				this.setActive(conv.id);
			});

			// 重命名按钮：改为内联 input 编辑
			$item.find(".edit").click((e) => {
				e.stopPropagation();
				const $nameDiv = $item.find(".name");
				// 如果已经是 input，直接 focus
				if ($nameDiv.find("input").length) {
					$nameDiv.find("input").focus();
					return;
				}
				const original = conv.name;
				const $input = $(`<input class="conv-rename-input" type="text" value="${original}" oninput="$(this).removeClass('error')"/>`);
				$nameDiv.empty().append($input);
				$input.focus().select();

				$item.addClass("renaming");

				const finalize = () => {
					const newName = $input.val().trim() || original;
					// 重名校验
					if (this._isNameExists(newName, conv.id)) {
						// alert("会话名称已存在，请输入不同的名称。");
						$item.addClass("error");
						$input.focus();
						return;
					}
					this.renameConversation(conv.id, newName);
				};

				$input.on("keydown", (ev) => {
					if (ev.key === "Enter") {
						ev.preventDefault();
						finalize();
					} else if (ev.key === "Escape") {
						// 取消编辑，恢复文字
						$nameDiv.text(original);
						$item.removeClass("renaming error");
					}
				});
				// blur 时应用（或提示重名）
				$input.on("blur", () => {
					finalize();
				});
			});

			// 删除按钮
			$item.find(".del").click((e) => {
				e.stopPropagation();
				this.deleteConversation(conv.id);
			});
			$container.append($item);
		}
	}

	// 外部订阅点，ChatManager 在此方法中更新自己的 state
	triggerChange() {
		// 当会话改变时，触发 onConversationChanged（如果存在）
		if (typeof dom.onConversationChanged === "function") {
			dom.onConversationChanged();
		}
		this.renderSidebar();
	}
}

// 在文件加载完成后实例化单例
window.conversationManager = new ConversationManager();