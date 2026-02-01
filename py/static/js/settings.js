class Settings {
  constructor() {
    // 开启调试输出以便定位交换/抖动问题，发布时可设为 false
    this.debug = true;
  }

  getSettings(){
    let ret={
      simplePrompt:
        typeof DEFAULT_SETTINGS.simplePrompt
          ? DEFAULT_SETTINGS.simplePrompt
          : '',
      toolCallPrompt:
        typeof DEFAULT_SETTINGS.toolCallPrompt
          ? DEFAULT_SETTINGS.toolCallPrompt
          : '',
      temperature:
        typeof DEFAULT_SETTINGS.temperature
          ? DEFAULT_SETTINGS.temperature
          : 0.7,
      stream:
        typeof DEFAULT_SETTINGS.stream
          ? DEFAULT_SETTINGS.stream
          : true,
      autoTheme:
        typeof DEFAULT_SETTINGS.autoTheme
          ? DEFAULT_SETTINGS.autoTheme
          : true,
      theme:
        typeof DEFAULT_SETTINGS.theme
          ? DEFAULT_SETTINGS.theme
          : null,
      models:
        typeof DEFAULT_SETTINGS.models
          ? DEFAULT_SETTINGS.models
          : AVAILABLE_MODELS,
      tools_disabled: {},
    };

    const savedSettings = JSON.parse(
      localStorage.getItem("chatSettings"));
    for (const key in ret) {
      if (savedSettings && key in savedSettings) {
        ret[key] = savedSettings[key];
      }
    }
    return ret;
  }

  // 设置相关方法
  openSettings() {
    // 填充当前设置
    $("#setting-token").val(ghtoken || "");
    if (!ghtoken || ghtoken === "") {
      $("#setting-token").addClass("error");
    } else {
      $("#setting-token").removeClass("error");
    }
    $("#setting-simple-prompt").val(settings_data.simplePrompt || "");
    $('#setting-toolcall-prompt').val(settings_data.toolCallPrompt || "");
    $("#setting-temperature")
      .val(settings_data.temperature || 0.7)
      .trigger("input");
    $("#setting-stream").prop("checked", settings_data.stream !== false);

    // 填充模型列表
    this.renderModelSettings();

    // 填充工具列表
    this.renderToolSettings();

    $('#app').removeClass("show");
    $("#settings-modal").addClass("show");

    $('#settings-sidebar>.list>.a').removeClass('active');
    $('#settings-sidebar>.list>.section-general').addClass('active');
    $(".settings-section").removeClass("active");
    $(".settings-section.section-general").addClass("active");
  }

  closeSettings() {
    $("#settings-modal").removeClass("show");
    $('#app').addClass("show");
  }

  async saveSettings() {
    const newSettings = {
      ...settings_data,
      simplePrompt: $("#setting-simple-prompt").val(),
      toolCallPrompt: $('#setting-toolcall-prompt').val(),
      temperature: parseFloat($("#setting-temperature").val()),
      stream: $("#setting-stream").prop("checked"),
      autoTheme: $("#setting-theme").val() === "auto",
      theme:
        $("#setting-theme").val() === "auto" ? null : $("#setting-theme").val(),
    };

    // 保存 token
    const newToken = $("#setting-token").val().trim();
    if (newToken !== ghtoken) {
      ghtoken = newToken;
      localStorage.setItem("ghtoken", newToken);
      if (newToken) {
        $("#token-error").hide();
      } else {
        $("#token-error").show();
      }
    }

    // 保存模型列表
    newSettings.models = this.getModelListFromUI();

    // 更新设置
    settings_data = newSettings;
    localStorage.setItem("chatSettings", JSON.stringify(newSettings));

    // 应用主题
    if (newSettings.autoTheme) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      document.documentElement.setAttribute(
        "data-theme",
        prefersDark ? "dark" : "light"
      );
    } else {
      document.documentElement.setAttribute("data-theme", newSettings.theme);
    }

    // 重新加载模型列表
    dom.loadModels();

    this.closeSettings();
  }

  renderToolSettings() {
    const $toolList = $("#av-tools-list").empty();
    av_tools.forEach(tool => {
      $toolList.append(`<div class="a" onclick="$(this).find('.tool-enable').click();">
        <input type="checkbox" class="tool-enable" data-tool-name="${tool.function.name}"
          ${settings_data.tools_disabled[tool.function.name]?'':'checked'}
          onchange="settingManager.toggleToolEnable('${tool.function.name}');"
          onclick="event.stopPropagation();" />
        <div>
          <span class="name">${tool.function.name}</span>
          <div class="description">${tool.function.description}</div>
        </div>
      </div>`);
    });
  }

  toggleToolEnable(toolName) {
    const isEnabled = $(`#a-vtools-list .tool-enable[data-tool-name="${toolName}"]`).prop("checked");
    settings_data.tools_disabled[toolName] = !isEnabled;
  }

  // 设置面板的模型列表管理
  renderModelSettings() {
    const $modelList = $("#model-list").empty();
    Object.entries(settings_data.models).forEach(([id, name]) => {
      $modelList.append(this.createModelCard(id, name));
    });
    $modelList.append($(`
                    <div class="add-model-btn" id="add-model-btn" onclick="settingManager.newModel();">
                        <span class="sfi">&#xE710;</span>
                        <span>添加新模型</span>
                    </div>`))

    // 初始化拖拽排序（每次重新渲染时绑定）
    this.initDragSorting();
  }

  newModel(){
    $(this.createModelCard("", "")).insertBefore("#add-model-btn");
    // 重新绑定拖拽事件到新卡片
    this.initDragSorting();
  }

  createModelCard(id, name) {
    return $(`
            <div class="model-card">
                <div class="model-field">
                    <label>模型ID</label>
                    <input type="text" class="model-id" value="${id}" onpointerdown="event.stopPropagation();">
                </div>
                <div class="model-field">
                    <label>显示名称</label>
                    <input type="text" class="model-name" value="${name}" onpointerdown="event.stopPropagation();">
                </div>
                <div class="model-actions">
                    <button class="small-btn delete-model">
                        <span class="sfi">&#xE711;</span>
                    </button>
                </div>
            </div>
        `);
  }

  getModelListFromUI() {
    const models = {};
    $(".model-card").each(function () {
      const id = $(this).find(".model-id").val().trim();
      const name = $(this).find(".model-name").val().trim();
      if (id && name) {
        models[id] = name;
      }
    });
    return models;
  }

  /* ===== 拖拽排序相关实现（基于 pointer 事件，不使用 HTML5 drag） ===== */
  initDragSorting() {
    // 清除旧的事件，重新绑定到每个 card
    const container = document.getElementById("model-list");
    if (!container) return;
    // 使用原生 DOM 便于 pointer capture
    const cards = Array.from(container.querySelectorAll(".model-card"));
    cards.forEach(card => {
      // remove previous handlers by cloning (simple way)
      const newCard = card.cloneNode(true);
      card.parentNode.replaceChild(newCard, card);
    });

    // 绑定事件
    Array.from(container.querySelectorAll(".model-card")).forEach(card => {
      card.style.touchAction = "none";
      card.addEventListener("pointerdown", (e) => this._onPointerDown(e, card));
      // delete 按钮绑定（保持原有功能）
      const del = card.querySelector(".delete-model");
      if (del) {
        del.addEventListener("click", (ev) => {
          ev.stopPropagation();
          $(card).remove();
        });
      }
    });
  }

  _onPointerDown(e, card) {
    // 不在卡片可交互按钮上启动拖拽（例如删除按钮）
    if (e.target.closest(".delete-model") || e.button !== 0) return;

    e.preventDefault();
    card.setPointerCapture && card.setPointerCapture(e.pointerId);

    const container = document.getElementById("model-list");
    const rect = card.getBoundingClientRect();

    // 创建占位符 ghost
    const ghost = document.createElement("div");
    ghost.className = "model-ghost";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";

    // 插入占位符到被拖拽卡片的位置（放在 card 之前），保证占位正确
    card.parentNode.insertBefore(ghost, card);

    // 记录单元格基础尺寸（用于网格对齐）
    const cellWidth = rect.width;
    const cellHeight = rect.height;

    // 设置拖动卡片为 fixed，使其脱离文档流并随指针移动
    card.classList.add("dragging");
    card.style.position = "fixed";
    card.style.left = rect.left + "px";
    card.style.top = rect.top + "px";
    card.style.width = rect.width + "px";
    card.style.zIndex = 10000;
    card.style.pointerEvents = "none";

    // 状态（保存 cell 大小）
    this._dragState = {
      card,
      ghost,
      container,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      pointerId: e.pointerId,
      moveHandler: null,
      upHandler: null,
      cellWidth,
      cellHeight,
      lastInsertion: null // 新增：记录上一次插入索引，避免抖动
    };

    const moveHandler = (ev) => this._onPointerMove(ev);
    const upHandler = (ev) => this._onPointerUp(ev);

    this._dragState.moveHandler = moveHandler;
    this._dragState.upHandler = upHandler;

    document.addEventListener("pointermove", moveHandler);
    document.addEventListener("pointerup", upHandler);
  }

  _onPointerMove(e) {
    const st = this._dragState;
    if (!st) return;
    e.preventDefault();

    const { card, ghost, container, offsetX, offsetY, cellWidth, cellHeight } = st;
    // 更新卡片位置（fixed）
    const left = e.clientX - offsetX;
    const top = e.clientY - offsetY;
    card.style.left = left + "px";
    card.style.top = top + "px";

    // 中心点
    const centerX = left + cellWidth / 2;
    const centerY = top + cellHeight / 2;

    const containerRect = container.getBoundingClientRect();

    // 获得参考元素（排除拖拽卡片、占位符和添加按钮）
    const children = Array.from(container.children).filter(node =>
      node !== card &&
      !node.classList.contains('model-ghost') &&
      !node.classList.contains('add-model-btn')
    );

    if (children.length === 0) {
      if (ghost.parentNode !== container) container.appendChild(ghost);
      return;
    }

    // 优先从 computed style 获取 gap（稳定），回退到测量法
    let gapX = 20, gapY = 20;
    let gapSource = "measured";
    try {
      const cs = window.getComputedStyle(container);
      // 支持 gap, columnGap, rowGap（浏览器差异）
      const rawGap = cs.getPropertyValue("gap") || cs.getPropertyValue("column-gap") || cs.getPropertyValue("columnGap");
      const rawRowGap = cs.getPropertyValue("row-gap") || cs.getPropertyValue("rowGap");
      const parsedGap = parseFloat(rawGap);
      const parsedRowGap = parseFloat(rawRowGap);
      if (!Number.isNaN(parsedGap)) {
        gapX = parsedGap;
        gapSource = "computed-gap";
      }
      if (!Number.isNaN(parsedRowGap)) {
        gapY = parsedRowGap;
      } else {
        gapY = gapX;
      }
    } catch (err) {
      // ignore, fallback to measured below
      gapSource = "fallback";
    }

    // 若 computed style 未成功解析，则使用以前的近似测量（兼容）
    if (gapSource === "measured" || gapSource === "fallback") {
      if (children.length >= 2) {
        const a = children[0].getBoundingClientRect();
        // 找到同一行的下一个元素以计算 gapX（若第二个在下一行则找后续）
        let b = children.find((c, idx) => {
          if (idx === 0) return false;
          const r = c.getBoundingClientRect();
          return Math.abs(r.top - a.top) < (a.height / 2);
        });
        if (!b) b = children[1];
        const br = b.getBoundingClientRect();
        gapX = Math.max(0, br.left - a.left - a.width);
      }
      // 垂直 gap：找下一行元素
      if (children.length >= 2) {
        const firstTop = children[0].getBoundingClientRect().top;
        const nextRow = children.find(c => Math.abs(c.getBoundingClientRect().top - firstTop) > 1);
        if (nextRow) {
          const a = children[0].getBoundingClientRect();
          const b = nextRow.getBoundingClientRect();
          gapY = Math.max(0, b.top - a.top - a.height);
        }
      }
    }

    const colWidth = cellWidth + gapX;
    const rowHeight = cellHeight + gapY;
    const availableWidth = containerRect.width;
    const columns = Math.max(1, Math.floor((availableWidth + gapX) / colWidth));

    const relX = centerX - containerRect.left;
    const relY = centerY - containerRect.top;
    let col = Math.floor(relX / colWidth);
    let row = Math.floor(relY / rowHeight);
    col = Math.max(0, Math.min(columns - 1, col));
    if (row < 0) row = 0;
    let insertionIndex = row * columns + col;
    insertionIndex = Math.max(0, Math.min(children.length, insertionIndex));

    // 迟滞：要求卡片中心足够进入目标格的“内边距区域”才切换，避免边界抖动
    const cellLeft = containerRect.left + col * colWidth;
    const cellTop = containerRect.top + row * rowHeight;
    const padX = Math.min(colWidth * 0.25, 20); // 内边距
    const padY = Math.min(rowHeight * 0.25, 20);
    const insideX = centerX >= (cellLeft + padX) && centerX <= (cellLeft + colWidth - padX);
    const insideY = centerY >= (cellTop + padY) && centerY <= (cellTop + rowHeight - padY);

    if (!(insideX && insideY)) {
      if (this.debug) console.debug("[drag] not inside target cell padding, skip update");
      return;
    }

    // 只有当插入索引实际变化时继续（避免重复 DOM 操作）
    if (st.lastInsertion === insertionIndex) {
      return;
    }

    // 进行 FLIP 动画：记录受影响元素的 rect（所有 children + ghost），并保存内联样式以便恢复
    const beforeRects = new Map();
    const oldStyles = new Map();
    const affectedBefore = Array.from(container.children).filter(n => n !== card && !n.classList.contains('add-model-btn'));
    affectedBefore.forEach(el => {
      beforeRects.set(el, el.getBoundingClientRect());
      oldStyles.set(el, {
        transition: el.style.transition || "",
        transform: el.style.transform || ""
      });
    });

    // 执行 DOM 插入（把 ghost 放到 children[insertionIndex] 前）
    // 修正：如果 insertionIndex 在 children.length（即末尾），应在 add-model-btn 之前插入，避免放到添加按钮之后
    const addBtn = container.querySelector('.add-model-btn');
    if (insertionIndex >= children.length) {
      if (addBtn) {
        container.insertBefore(ghost, addBtn);
      } else {
        container.appendChild(ghost);
      }
    } else {
      const ref = children[insertionIndex];
      container.insertBefore(ghost, ref);
    }

    // 记录 after rects 与执行动画（排除 add-model-btn 和正在拖拽的 card）
    const affectedAfter = Array.from(container.children).filter(n => n !== card && !n.classList.contains('add-model-btn'));
    affectedAfter.forEach(el => {
      const before = beforeRects.get(el) || null;
      const after = el.getBoundingClientRect();
      if (before) {
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (dx !== 0 || dy !== 0) {
          // 保存并施加逆向位移与无过渡状态
          const old = oldStyles.get(el) || { transition: el.style.transition || "", transform: el.style.transform || "" };
          el.style.transition = "none";
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          // 强制回流
          el.getBoundingClientRect();
          // 清除 transform，恢复原内联 transition（以触发 CSS 中定义的 transition）
          requestAnimationFrame(() => {
            el.style.transition = old.transition;
            el.style.transform = old.transform;
          });
        }
      }
    });

    // 更新 lastInsertion
    st.lastInsertion = insertionIndex;
  }

  _onPointerUp(e) {
    const st = this._dragState;
    if (!st) return;
    e.preventDefault();

    const { card, ghost, container, pointerId, moveHandler, upHandler } = st;

    // 移除事件
    document.removeEventListener("pointermove", moveHandler);
    document.removeEventListener("pointerup", upHandler);
    try {
      card.releasePointerCapture && card.releasePointerCapture(pointerId);
    } catch (err) { /* ignore */ }

    // 如果 ghost 不存在，直接回退到旧行为
    if (!ghost || !ghost.parentNode) {
      // 将卡片直接插回（无动画）
      if (card.parentNode) {
        // ensure already in container
      } else if (ghost && ghost.parentNode) {
        ghost.parentNode.insertBefore(card, ghost);
      }
      // 清理样式
      card.classList.remove("dragging");
      card.style.position = "";
      card.style.left = "";
      card.style.top = "";
      card.style.width = "";
      card.style.zIndex = "";
      card.style.pointerEvents = "";
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      this._dragState = null;
      this.initDragSorting();
      return;
    }

    // 目标位置（ghost 的位置）
    const targetRect = ghost.getBoundingClientRect();
    const currentRect = card.getBoundingClientRect();

    // 先移除 dragging 类以恢复 CSS 中的 transition（.model-card 有 transform 过渡）
    card.classList.remove("dragging");

    // 计算移动距离（在 fixed 坐标系下）
    const dx = targetRect.left - currentRect.left;
    const dy = targetRect.top - currentRect.top;

    // 保证 card 仍为 fixed（之前已设），并添加 transform 动画
    // 设置过渡（以防某些样式被覆盖）
    card.style.transition = "transform 150ms ease";
    // 触发动画
    requestAnimationFrame(() => {
      card.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    // 动画结束后将 card 插回 DOM（在 ghost 前），清理样式并移除 ghost
    const onTransitionEnd = (ev) => {
      if (ev.propertyName && ev.propertyName !== "transform") return;
      card.removeEventListener("transitionend", onTransitionEnd);

      // 插回 DOM（在占位 ghost 处）
      if (ghost.parentNode) {
        ghost.parentNode.insertBefore(card, ghost);
      }

      // 清理样式（恢复流内布局）
      card.style.transition = "";
      card.style.transform = "";
      card.style.position = "";
      card.style.left = "";
      card.style.top = "";
      card.style.width = "";
      card.style.zIndex = "";
      card.style.pointerEvents = "";

      // 移除占位符
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);

      // 清理状态 & 重新绑定
      this._dragState = null;
      // small timeout 确保 DOM 插入结束再重新绑定
      setTimeout(() => this.initDragSorting(), 0);
    };

    card.addEventListener("transitionend", onTransitionEnd);

    // 保险：若浏览器不触發 transitionend（如超短距离），设置超时回退
    setTimeout(() => {
      // 若状态已被清理则无需重复
      if (!this._dragState) return;
      // 强制触发结束流程
      card.dispatchEvent(new Event('transitionend'));
    }, 300);
  }

  /* ===== 结束拖拽实现 ===== */
}
