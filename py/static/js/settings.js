class Settings {
  constructor() { }

  getSettings=()=>JSON.parse(localStorage.getItem("chatSettings"));

  initSettings() {
    // 初始化 + 清理遗留数据
    let ret = {
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
      modelList: Array.isArray(DEFAULT_SETTINGS.modelList) ? DEFAULT_SETTINGS.modelList.slice() : [],
      providers: Array.isArray(DEFAULT_SETTINGS.providers) ? DEFAULT_SETTINGS.providers.slice() : [],
      tools_disabled: {},
    };

    const savedSettings = JSON.parse(localStorage.getItem("chatSettings") || "null");

    // 合并已保存的字段（兼容旧格式）
    if (savedSettings) {
      if (Array.isArray(savedSettings.modelList)) {
        ret.modelList = savedSettings.modelList.slice();
      } else if (savedSettings.models && typeof savedSettings.models === 'object') {
        // 兼容旧格式，将 mapping 转为 modelList（provider 默认为 github）
        ret.modelList = Object.entries(savedSettings.models).map(([id, name], idx) => ({
          id,
          name,
          provider: 'github',
          pid: idx + 1
        }));
        ret.models=undefined;
      }
      if (Array.isArray(savedSettings.providers)) {
        ret.providers = savedSettings.providers.slice();
      } else if (savedSettings.provider) {
        // noop
      }
      if (savedSettings.tools_disabled) ret.tools_disabled = savedSettings.tools_disabled;
      if (savedSettings.simplePrompt) ret.simplePrompt = savedSettings.simplePrompt;
      if (savedSettings.toolCallPrompt) ret.toolCallPrompt = savedSettings.toolCallPrompt;
      if (typeof savedSettings.temperature === 'number') ret.temperature = savedSettings.temperature;
      if (typeof savedSettings.stream !== 'undefined') ret.stream = savedSettings.stream;
      if (typeof savedSettings.autoTheme !== 'undefined') ret.autoTheme = savedSettings.autoTheme;
      if (typeof savedSettings.theme !== 'undefined') ret.theme = savedSettings.theme;
    }

    // 迁移旧的单独 ghtoken（若存在），写入 providers.github.api_key 并删除原 localStorage
    const legacyToken = localStorage.getItem("ghtoken");
    if (legacyToken) {
      // 若 providers 中已有 github，填充 api_key；否则插入一个默认 github provider
      let found = false;
      if (Array.isArray(ret.providers)) {
        for (let p of ret.providers) {
          if (p.key === "github") {
            p.api_key = legacyToken;
            found = true;
            break;
          }
        }
      } else {
        ret.providers = [];
      }
      if (!found) {
        ret.providers.unshift({
          name: "GitHub Models",
          key: "github",
          api_endpoint: "https://models.github.ai/inference",
          request_type: "openai_compatible",
          api_key: legacyToken
        });
      }
      localStorage.removeItem("ghtoken");
    }

    // 确保每个 model 有 pid
    for (let i = 0; i < ret.modelList.length; i++) {
      if (!ret.modelList[i].pid) ret.modelList[i].pid = i + 1;
    }
    
    if (localStorage.getItem("defaultModel")) {
      localStorage.removeItem("defaultModel");
    }
    
    localStorage.setItem("chatSettings",JSON.stringify(ret));
  }

  // 设置相关方法
  openSettings() {
    $("#setting-simple-prompt").val(settings_data.simplePrompt || "");
    $('#setting-toolcall-prompt').val(settings_data.toolCallPrompt || "");
    $("#setting-temperature")
      .val(settings_data.temperature || 0.7)
      .trigger("input");
    $("#setting-stream").prop("checked", settings_data.stream !== false);

    // 渲染模型与服务商列表
    this.renderModelSettings();
    this.renderProviderSettings();
    // 填充工具列表
    this.renderToolSettings();

    $('#app').removeClass("show");
    $("#settings-modal").show().addClass("show");
    setTimeout($('#app').hide, 200);

    $('#settings-sidebar>.list>.a').removeClass('active');
    $('#settings-sidebar>.list>.section-general').addClass('active');
    $(".settings-section").removeClass("active");
    $(".settings-section.section-general").addClass("active");
  }

  closeSettings() {
    $("#settings-modal").removeClass("show");
    $('#app').show().addClass("show");
    setTimeout($('#settings-modal').hide, 200);
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

    // 保存模型列表（从 UI 获取为数组）
    newSettings.modelList = this.getModelListFromUI();

    // 保存 providers（从 UI）
    newSettings.providers = this.getProvidersFromUI();

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

    // 如果当前 pid 仍然有效则保持，否则切换到第一个 model 的 pid
    if (typeof currentModelPid !== "undefined" && configUtils.findModelByPid(currentModelPid)) {
      selectModel(currentModelPid);
    } else {
      const firstPid = newSettings.modelList[0].pid;
      if (firstPid) selectModel(firstPid);
    }

    this.closeSettings();
  }

  // 渲染服务商设置区域（请求类型改为 select）
  renderProviderSettings() {
    const $pv = $("#providers-list").empty();
    (settings_data.providers || []).forEach((p, idx) => {
      const $item = $(`
        <div class="provider-item" data-index="${idx}" style="padding:10px;border-bottom:1px solid var(--border-color);">
          <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
            <strong class="provider-name">${p.name}</strong>
            <!--button class="delete-provider small-btn" title="删除"><span class="sfi">&#xE711;</span></button-->
          </div>
          <div style="margin-top:8px;" class="form-field">
            <div><label>显示名称</label><input class="provider-name-input" type="text" value="${p.name}"/></div>
            <!--保留以存储数据-->
            <div style="display:none"><label>Key</label><input class="provider-key-input" type="text" value="${p.key}"/></div>
            <div><label>API 节点 (completion 完整路径)</label><input class="provider-endpoint-input" type="text" value="${p.api_endpoint}"/></div>
            <div><label>请求类型</label>
              <select class="provider-type-input">
                <option value="openai_compatible"${p.request_type==='openai_compatible'?' selected':''}>OpenAI 兼容</option>
              </select>
            </div>
            <div><label>密钥</label><input class="provider-apikey-input" type="text" value="${p.api_key || ''}"/></div>
          </div>
        </div>
      `);
      // $item.find('.delete-provider').click((e)=>{ e.stopPropagation(); $item.remove(); });
      $pv.append($item);
    });
    $pv.append($(`<div style="margin-top:8px;padding:10px;"><button id="add-provider" class="button">添加服务商</button></div>`));
    $pv.find('#add-provider').click(()=> {
      const idx = $('#providers-list .provider-item').length;
      const $item = $(`
        <div class="provider-item" data-index="${idx}" style="padding:10px;border-bottom:1px solid var(--border-color);">
          <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
            <strong class="provider-name">新服务商</strong>
            <button class="delete-provider small-btn" title="删除"><span class="sfi">&#xE711;</span></button>
          </div>
          <div style="margin-top:8px;" class="form-field">
            <div><label>显示名称</label><input class="provider-name-input" type="text" value="新服务商"/></div>
            
            <div><label>键（首次填写后不可更改）</label><input class="provider-key-input" type="text" value=""/></div>
            <div><label>API 节点 (completion 完整路径)</label><input class="provider-endpoint-input" type="text" value=""/></div>
            <div><label>请求类型</label>
              <select class="provider-type-input">
                <option value="openai_compatible">OpenAI 兼容</option>
              </select>
            </div>
            <div><label>密钥</label><input class="provider-apikey-input" type="text" value=""/></div>
          </div>
        </div>
      `);
      $item.find('.delete-provider').click((e)=>{ e.stopPropagation(); $item.remove(); });
      $('#providers-list').append($item);
    });
  }

  // 设置面板的模型列表管理
  renderModelSettings() {
    const $modelList = $("#model-list").empty();
    const providers = settings_data.providers || [];

    var max_id=1;
    settings_data.modelList.forEach((m, idx) => {
      const provOptions = providers.map(p => `<option value="${p.key}" ${p.key===m.provider?'selected':''}>${p.name}</option>`).join('');
      const $item = $(`<div class="model-list-item" data-index="${idx}">
          <div class="model-summary">
            <span class="drag-handle sfi" title="拖动排序">&#xE700;</span>
            <span class="model-name-display">${m.name || ''}</span>
            <button class="toggle-details toolbar-button" title="展开"><span class="sfi">&#xE70D;</span></button>
          </div>
          <div class="model-details form-field" style="display:none; margin-top:8px;">
            <div><label>显示名称</label><input class="model-name" type="text" value="${m.name || ''}"/></div>
            <div><label>API 标识 (id)</label><input class="model-id" type="text" value="${m.id || ''}"/></div>
            <div><label>服务商</label><select class="model-provider">${provOptions}</select></div>
            <div style="display:none"><label>pid</label><input class="model-pid" disabled value="${m.pid}" type="number"/></div>
            <div style="margin-top:10px;float:right;">
              <button class="delete-model red button"><span class="sfi">&#xE711;</span>删除</button>
            </div>
          </div>
        </div>`);
      $modelList.append($item);
      if(m.pid>max_id)max_id=m.pid;
    });

    // 添加“添加新模型”按钮
    $modelList.append($(`<div class="add-model-btn" id="add-model-btn"><span class="sfi">&#xE710;</span> 添加新模型</div>`));
    $modelList.find('#add-model-btn').click(()=> {
      const idx = $('#model-list .model-list-item').length;
      const provOptions = (settings_data.providers||[]).map(p=>`<option value="${p.key}">${p.name}</option>`).join('');
      const $item = $(`<div class="model-list-item" data-index="${idx}">
          <div class="model-summary">
            <span class="drag-handle sfi" title="拖动排序">&#xE700;</span>
            <span class="model-name-display">新模型</span>
            <button class="toggle-details toolbar-button" title="展开"><span class="sfi">&#xE70D;</span></button>
          </div>
          <div class="model-details form-field" style="display:block; margin-top:8px;">
            <div><label>显示名称</label><input class="model-name" type="text" value="新模型"/></div>
            <div><label>API 标识 (id)</label><input class="model-id" type="text" value=""/></div>
            <div><label>服务商</label><select class="model-provider">${provOptions}</select></div>
            <div style="display:none"><label>pid</label><input class="model-pid" disabled value="${++max_id}" type="number"/></div>
            <div style="margin-top:10px;float:right;">
              <button class="delete-model red button"><span class="sfi">&#xE711;</span>删除</button>
            </div>
          </div>
        </div>`);
      // 插入到 按钮 之前
      $modelList.find('#add-model-btn').before($item);

      // 重新初始化拖拽绑定
      this.initModelDragSorting();
    });

    // 使用事件委托绑定详情切换与删除，避免在 initModelDragSorting 克隆元素时丢失绑定
    $modelList.off('click', '.toggle-details').on('click', '.toggle-details', function(e){
      e.stopPropagation();
      const $item = $(this).closest('.model-list-item');
      const $det = $item.find('.model-details');
      const showing = $det.is(':visible');
      $(this).find('.sfi').toggleClass('down',!showing);
      $det.toggle();
    });
    $modelList.off('click', '.delete-model').on('click', '.delete-model', function(e){
      e.stopPropagation();
      $(this).closest('.model-list-item').remove();
    });

    // 初始化拖拽
    this.initModelDragSorting();
  }

  // 新增：初始化模型列表的拖拽排序（仅通过把手拖拽）
  initModelDragSorting() {
    const container = document.getElementById("model-list");
    if (!container) return;

    // 移除旧的 handler
    if (container._dragHandler) {
      container.removeEventListener('pointerdown', container._dragHandler);
      container._dragHandler = null;
    }

    // 通过委托，仅响应把手的 pointerdown
    const handler = (e) => {
      const handle = e.target.closest && e.target.closest('.drag-handle');
      if (!handle) return;
      const card = handle.closest('.model-list-item');
      this._onModelPointerDown(e, card);
    };
    container._dragHandler = handler;
    container.addEventListener('pointerdown', handler);
  }

  _onModelPointerDown(e, card) {
    // 仅左键
    if (e.button !== 0) return;
    // 防止在交互控件上触发
    if (e.target.closest("button, input, select, textarea")) return;

    e.preventDefault();
    card.setPointerCapture && card.setPointerCapture(e.pointerId);

    const container = document.getElementById("model-list");
    const rect = card.getBoundingClientRect();
    const placeholder = document.createElement("div");
    placeholder.className = "model-placeholder";
    placeholder.style.height = rect.height + "px";
    card.parentNode.insertBefore(placeholder, card.nextSibling);

    // 记录偏移（相对 card 的鼠标位置）
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 固定样式
    card.classList.add("dragging");
    card.style.position = "fixed";
    card.style.left = rect.left + "px";
    card.style.top = rect.top + "px";
    card.style.width = rect.width + "px";
    card.style.zIndex = 10000;
    card.style.pointerEvents = "none";

    this._modelDragState = {
      card, placeholder, container, offsetX, offsetY,
      moveHandler: (ev) => this._onModelPointerMove(ev),
      upHandler: (ev) => this._onModelPointerUp(ev),
    };

    document.addEventListener("pointermove", this._modelDragState.moveHandler);
    document.addEventListener("pointerup", this._modelDragState.upHandler);
  }

  _onModelPointerMove(e) {
    const st = this._modelDragState;
    if (!st) return;
    e.preventDefault();
    const { card, placeholder, container, offsetX, offsetY } = st;
    const left = e.clientX - offsetX;
    const top = e.clientY - offsetY;
    card.style.left = left + "px";
    card.style.top = top + "px";

    // 计算插入位置：根据中心点与其他元素比较
    const centerY = top + card.getBoundingClientRect().height / 2;
    const children = Array.from(container.querySelectorAll(".model-list-item")).filter(n => n !== card);
    let insertBeforeEl = null;
    for (const ch of children) {
      const r = ch.getBoundingClientRect();
      const chCenter = r.top + r.height / 2;
      if (centerY < chCenter) {
        insertBeforeEl = ch;
        break;
      }
    }
    if (insertBeforeEl) {
      container.insertBefore(placeholder, insertBeforeEl);
    } else {
      const addBtn = container.querySelector("#add-model-btn");
      if (addBtn) container.insertBefore(placeholder, addBtn);
      else container.appendChild(placeholder);
    }
  }

  _onModelPointerUp(e) {
    const st = this._modelDragState;
    if (!st) return;
    const { card, placeholder, container, moveHandler, upHandler } = st;
    document.removeEventListener("pointermove", moveHandler);
    document.removeEventListener("pointerup", upHandler);
    try { card.releasePointerCapture && card.releasePointerCapture(e.pointerId); } catch (err) {}

    // 插回 DOM 到 placeholder 位置
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(card, placeholder);
      placeholder.parentNode.removeChild(placeholder);
    }
    // 清理样式
    card.classList.remove("dragging");
    card.style.position = "";
    card.style.left = "";
    card.style.top = "";
    card.style.width = "";
    card.style.zIndex = "";
    card.style.pointerEvents = "";

    this._modelDragState = null;

  }

  // 从 UI 收集 modelList（数组） — 改为按 DOM 顺序生成连续 pid
  getModelListFromUI() {
    const arr = [];
    $("#model-list .model-list-item").each(function(){
      const name = $(this).find('.model-name').val() || $(this).find('.model-name-display').text() || '';
      const id = $(this).find('.model-id').val().trim();
      const provider = $(this).find('.model-provider').val() || 'github';
      const pidVal = parseInt($(this).find('.model-pid').val());
      if (id) {
        arr.push({ id, name, provider, pid: pidVal });
      }
    });
    return arr;
  }

  // 从 UI 获取 providers 列表
  getProvidersFromUI() {
    const arr = [];
    $("#providers-list .provider-item").each(function(){
      const name = $(this).find('.provider-name-input').val().trim();
      const key = $(this).find('.provider-key-input').val().trim();
      const api_endpoint = $(this).find('.provider-endpoint-input').val().trim();
      const request_type = $(this).find('.provider-type-input').val().trim();
      const api_key = $(this).find('.provider-apikey-input').val().trim();
      if (key) {
        arr.push({ name, key, api_endpoint, request_type, api_key });
      }
    });
    return arr;
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
}
