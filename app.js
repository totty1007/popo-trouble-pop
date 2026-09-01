// トラブル対応POP印刷アプリ ロジック

let STORES = [];
let selectedFormat = null;
let dayListState = {}; // { fieldKey: [ {date,changeType,freeText}, ... ] }

const $ = (sel) => document.querySelector(sel);

async function init() {
  try {
    const res = await fetch("stores.json", { cache: "no-store" });
    STORES = await res.json();
  } catch (e) {
    STORES = [];
  }
  populateStoreSelect();
  populateFormatSelect();
  bindGlobalControls();
  renderFieldsForFormat(null);
  updatePreview();
}

function populateStoreSelect() {
  const sel = $("#storeSelect");
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- 店舗を選択 --";
  sel.appendChild(placeholder);

  const groups = {};
  STORES.forEach((s) => {
    const brand = s.brand || "ポポラマーマ";
    if (!groups[brand]) groups[brand] = [];
    groups[brand].push(s);
  });

  Object.keys(groups).forEach((brand) => {
    const og = document.createElement("optgroup");
    og.label = brand;
    groups[brand]
      .sort((a, b) => a.name.localeCompare(b.name, "ja"))
      .forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.dataset.brand = brand;
        opt.textContent = s.name;
        og.appendChild(opt);
      });
    sel.appendChild(og);
  });

  sel.addEventListener("change", updatePreview);
}

function populateFormatSelect() {
  const sel = $("#formatSelect");
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- フォーマットを選択 --";
  sel.appendChild(placeholder);

  const groups = {};
  FORMATS.forEach((f) => {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  });

  Object.keys(groups).forEach((cat) => {
    const og = document.createElement("optgroup");
    og.label = cat;
    groups[cat].forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.title;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });

  sel.addEventListener("change", () => {
    const fmt = FORMATS.find((f) => f.id === sel.value) || null;
    selectedFormat = fmt;
    dayListState = {};
    renderFieldsForFormat(fmt);
    updatePreview();
  });
}

function bindGlobalControls() {
  $("#orientation").addEventListener("change", updatePaperSize);
  $("#printBtn").addEventListener("click", () => window.print());
  window.addEventListener("resize", () => {
    layoutViewport();
    fitPreviewScale();
  });
  layoutViewport();
  updatePaperSize();
}

function layoutViewport() {
  const layout = $(".layout");
  const header = $(".app-header");
  const top = header.getBoundingClientRect().bottom;
  const h = Math.max(400, window.innerHeight - top - 24);
  layout.style.height = h + "px";
}

function fitPreviewScale() {
  const wrap = $(".preview-wrap");
  const page = $("#previewPage");
  // 実寸(mm指定分)を測るため一旦スケール1にリセットしてから採寸する
  page.style.setProperty("--preview-scale", "1");
  const availW = wrap.clientWidth - 48; // padding分を差し引く
  const availH = wrap.clientHeight - 48;
  const scale = Math.min(1, availW / page.offsetWidth, availH / page.offsetHeight);
  page.style.setProperty("--preview-scale", scale);
}

function updatePaperSize() {
  const orientation = $("#orientation").value; // portrait | landscape
  const preview = $("#previewPage");
  preview.className = "preview-page a4-fixed " + orientation;

  let styleTag = document.getElementById("printPageStyle");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "printPageStyle";
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = `@page { size: A4 ${orientation}; margin: 0; }`;
  fitPreviewScale();
}

function renderFieldsForFormat(fmt) {
  const container = $("#fieldsContainer");
  container.innerHTML = "";

  if (!fmt) {
    container.innerHTML =
      '<p class="hint">フォーマットを選択すると、入力項目がここに表示されます。</p>';
    return;
  }

  fmt.fields.forEach((field) => {
    const wrap = document.createElement("div");
    wrap.className = "field-row";

    if (field.type === "dayList") {
      wrap.appendChild(buildDayListField(field));
      container.appendChild(wrap);
      return;
    }

    const label = document.createElement("label");
    label.textContent = field.label + (field.optional ? "（任意）" : "");
    label.htmlFor = "f_" + field.key;
    wrap.appendChild(label);

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      field.options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
      if (field.allowCustom) {
        const o = document.createElement("option");
        o.value = "__custom__";
        o.textContent = "その他（自由入力）";
        input.appendChild(o);
      }
      if (field.default) input.value = field.default;
    } else if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = field.rows || 3;
      if (field.default) input.value = field.default;
    } else if (field.type === "checkboxGroup") {
      input = document.createElement("div");
      input.className = "checkbox-group";
      field.options.forEach((opt) => {
        const id = "f_" + field.key + "_" + opt;
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = opt;
        cb.id = id;
        cb.dataset.groupKey = field.key;
        cb.checked = (field.default || []).includes(opt);
        cb.addEventListener("change", updatePreview);
        const l = document.createElement("label");
        l.htmlFor = id;
        l.textContent = opt;
        l.className = "checkbox-label";
        const item = document.createElement("span");
        item.className = "checkbox-item";
        item.appendChild(cb);
        item.appendChild(l);
        input.appendChild(item);
      });
    } else {
      input = document.createElement("input");
      input.type = field.type === "date" ? "date" : field.type === "time" ? "time" : field.type === "number" ? "number" : "text";
      if (field.default) input.value = field.default;
      if (field.placeholder) input.placeholder = field.placeholder;
    }

    if (input.tagName !== "DIV") {
      input.id = "f_" + field.key;
      input.dataset.key = field.key;
      input.addEventListener("input", updatePreview);
      input.addEventListener("change", updatePreview);
    }
    wrap.appendChild(input);

    // custom text box for "その他" selects
    if (field.type === "select" && field.allowCustom) {
      const customInput = document.createElement("input");
      customInput.type = "text";
      customInput.id = "f_" + field.key + "_custom";
      customInput.placeholder = "自由入力";
      customInput.style.display = "none";
      customInput.addEventListener("input", updatePreview);
      input.addEventListener("change", () => {
        customInput.style.display = input.value === "__custom__" ? "block" : "none";
        updatePreview();
      });
      wrap.appendChild(customInput);
    }

    container.appendChild(wrap);
  });
}

function buildDayListField(field) {
  const box = document.createElement("div");
  box.className = "daylist-box";
  const label = document.createElement("label");
  label.textContent = field.label;
  box.appendChild(label);

  const rowsContainer = document.createElement("div");
  rowsContainer.className = "daylist-rows";
  box.appendChild(rowsContainer);

  if (!dayListState[field.key]) {
    dayListState[field.key] = [];
    const n = field.defaultRows || 1;
    for (let i = 0; i < n; i++) addDayRow(field, rowsContainer);
  } else {
    dayListState[field.key].forEach(() => addDayRow(field, rowsContainer, true));
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "＋ 行を追加";
  addBtn.className = "btn-secondary";
  addBtn.addEventListener("click", () => {
    if (dayListState[field.key].length >= (field.max || 5)) return;
    addDayRow(field, rowsContainer);
    updatePreview();
  });
  box.appendChild(addBtn);

  return box;
}

function addDayRow(field, rowsContainer, reuseExisting) {
  const idx = reuseExisting ? dayListState[field.key].length : dayListState[field.key].push({}) - 1;
  const row = document.createElement("div");
  row.className = "daylist-row";

  field.rowFields.forEach((rf) => {
    let el;
    if (rf.type === "select") {
      el = document.createElement("select");
      rf.options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        el.appendChild(o);
      });
    } else {
      el = document.createElement("input");
      el.type = rf.type === "date" ? "date" : "text";
      if (rf.placeholder) el.placeholder = rf.placeholder;
    }
    el.addEventListener("input", () => {
      dayListState[field.key][idx][rf.key] = el.value;
      updatePreview();
    });
    el.addEventListener("change", () => {
      dayListState[field.key][idx][rf.key] = el.value;
      updatePreview();
    });
    row.appendChild(el);
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "削除";
  removeBtn.className = "btn-remove";
  removeBtn.addEventListener("click", () => {
    dayListState[field.key].splice(idx, 1);
    row.remove();
    updatePreview();
  });
  row.appendChild(removeBtn);

  rowsContainer.appendChild(row);
}

function getFieldValue(field) {
  if (field.type === "checkboxGroup") {
    const checked = [];
    document
      .querySelectorAll(`input[data-group-key="${field.key}"]:checked`)
      .forEach((cb) => checked.push(cb.value));
    return checked;
  }
  const el = $("#f_" + field.key);
  if (!el) return field.default || "";
  if (field.type === "select" && el.value === "__custom__") {
    const custom = $("#f_" + field.key + "_custom");
    return custom ? custom.value : "";
  }
  if (field.type === "date" && el.value) {
    return formatDateJp(el.value);
  }
  if (field.type === "time" && el.value) {
    return el.value;
  }
  return el.value;
}

function formatDateJp(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  const week = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日（${week[d.getDay()]}）`;
}

function getStoreFull() {
  const sel = $("#storeSelect");
  if (!sel.value) return "各店舗";
  const opt = sel.selectedOptions[0];
  const brand = opt ? opt.dataset.brand : "ポポラマーマ";
  return brand + sel.value;
}

function isCarboBrand() {
  const sel = $("#storeSelect");
  const opt = sel.selectedOptions[0];
  return opt && opt.dataset.brand === "カルボラボ";
}

function buildValues(fmt) {
  const values = { storeFull: getStoreFull() };
  fmt.fields.forEach((field) => {
    if (field.type === "dayList") {
      const rows = dayListState[field.key] || [];
      const lines = rows
        .filter((r) => r.date)
        .map((r) => {
          let change = r.changeType || "";
          if (change === "自由記述") change = r.freeText || "";
          return `・${formatDateJp(r.date)}　${change}`;
        });
      values[field.key] = lines.join("\n");
    } else {
      values[field.key] = getFieldValue(field);
    }
  });

  // 特殊ブロック生成
  if ("lastOrderTime" in values) {
    values.lastOrderBlock = values.lastOrderTime
      ? `（ラストオーダー　${values.lastOrderTime}）`
      : "";
  }
  if ("reopenKnown" in values) {
    if (values.reopenKnown === "時刻が分かっている" && values.reopenTime) {
      values.reopenBlock = `営業再開は下記を予定しております。\n${values.reopenTime}　Open`;
    } else {
      values.reopenBlock = "再開目途が立ち次第、営業再開のご連絡をさせていただきます。";
    }
  }
  if ("unavailable" in values) {
    const unavailable = (values.unavailable || []).join("・") || "各種キャッシュレス決済";
    values.unavailable = unavailable;
    const available = (values.available || []).filter((a) => !(values.unavailable || "").includes(a));
    values.availableBlock = values.available && values.available.length
      ? `※${values.available.join("・")}は、引き続きご利用いただけます。`
      : "※現金でのお支払いをおすすめいたします。";
  }

  return values;
}

function renderBody(fmt, values) {
  let text = fmt.body;
  Object.keys(values).forEach((key) => {
    const v = Array.isArray(values[key]) ? values[key].join("・") : values[key] ?? "";
    text = text.split(`{{${key}}}`).join(v);
  });
  // 未置換の空行を整理
  text = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
  return text;
}

function updatePreview() {
  const preview = $("#previewPage");
  const logoArea = $("#previewLogo");
  const headingEl = $("#previewHeading");
  const bodyEl = $("#previewBody");

  const carbo = isCarboBrand();
  logoArea.style.display = carbo ? "flex" : "none";

  if (!selectedFormat) {
    headingEl.textContent = "";
    bodyEl.textContent = "フォーマットを選択してください。";
    return;
  }

  const values = buildValues(selectedFormat);
  const bodyText = renderBody(selectedFormat, values);

  let heading = selectedFormat.heading;
  if (selectedFormat.dynamicHeading) {
    heading = values.customHeading || "お知らせ";
  }
  const bracket = selectedFormat.bracket;
  headingEl.textContent = heading ? `${bracket}${heading}${mirrorBracket(bracket)}` : "";
  headingEl.style.display = heading ? "block" : "none";
  bodyEl.textContent = bodyText;
  fitPreviewScale();
}

function mirrorBracket(b) {
  const map = { "〈": "〉", "【": "】", "＜": "＞" };
  return map[b] || "";
}

document.addEventListener("DOMContentLoaded", init);
