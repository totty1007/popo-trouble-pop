// トラブル対応POP印刷アプリ ロジック

let STORES = [];
let selectedFormat = null;
let dayListState = {}; // { fieldKey: [ {date,changeType,freeText}, ... ] }

const $ = (sel) => document.querySelector(sel);

const AREA_ORDER = [
  "第1エリア",
  "第2エリア",
  "第3エリア",
  "第4エリア",
  "第5エリア",
  "第6エリア",
  "九州北エリア",
  "九州南エリア",
];
const NO_AREA_LABEL = "エリア未設定・その他";

const LOGO_OPTIONS = [
  { value: "", label: "ロゴなし（表示しない）" },
  { value: "logo_popo_illustration.png", label: "ポポラマーマ（イラスト）" },
  { value: "logo_popo_text.jpg", label: "ポポラマーマ（文字のみ）" },
  { value: "logo_popo_badge.png", label: "ポポラマーマ（丸バッジ）" },
  { value: "logo_bar_horizontal.jpg", label: "ポポラマーマバル（横）" },
  { value: "logo_bar_vertical.jpg", label: "ポポラマーマバル（縦）" },
  { value: "logo_choiwa.jpg", label: "ちょい和" },
];

async function init() {
  try {
    const res = await fetch("stores.json", { cache: "no-store" });
    STORES = await res.json();
  } catch (e) {
    STORES = [];
  }
  populateAreaSelect();
  populateStoreSelect();
  populateFormatSelect();
  populateLogoSelect();
  bindGlobalControls();
  renderFieldsForFormat(null);
  updatePreview();
}

function populateAreaSelect() {
  const sel = $("#areaSelect");
  sel.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "-- 全エリア（絞り込みなし） --";
  sel.appendChild(allOpt);

  const present = new Set(STORES.map((s) => s.area).filter(Boolean));
  AREA_ORDER.filter((a) => present.has(a)).forEach((area) => {
    const opt = document.createElement("option");
    opt.value = area;
    opt.textContent = area;
    sel.appendChild(opt);
  });

  if (STORES.some((s) => !s.area)) {
    const opt = document.createElement("option");
    opt.value = NO_AREA_LABEL;
    opt.textContent = NO_AREA_LABEL;
    sel.appendChild(opt);
  }

  sel.addEventListener("change", () => {
    populateStoreSelect();
    updatePreview();
  });
}

function populateStoreSelect() {
  const sel = $("#storeSelect");
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- 店舗を選択 --";
  sel.appendChild(placeholder);

  const areaFilter = $("#areaSelect").value;
  const filtered = STORES.filter((s) => {
    if (!areaFilter) return true;
    if (areaFilter === NO_AREA_LABEL) return !s.area;
    return s.area === areaFilter;
  });

  const groups = {};
  filtered.forEach((s) => {
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

function populateLogoSelect() {
  const sel = $("#logoSelect");
  sel.innerHTML = "";
  LOGO_OPTIONS.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
}

function bindGlobalControls() {
  $("#storeSelect").addEventListener("change", updatePreview);
  $("#orientation").addEventListener("change", updatePaperSize);
  $("#designSelect").addEventListener("change", updatePaperSize);
  // ロゴの有無で本文エリアの下端が変わるため、バッジ更新だけでなく
  // 文字サイズの再計算まで通す必要がある。
  $("#logoSelect").addEventListener("change", () => {
    updateLogoBadge();
    updatePreview();
  });
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
  // 背景・文字サイズ・印刷可否をまとめて再計算する（向き/デザイン変更時に文字サイズが
  // 古いままになる不具合を防ぐため、必ずupdatePreview経由で一本化する）
  updatePreview();
}

// 見出し帯・本文エリア・ロゴ枠の位置（ページ幅/高さに対する%）。
// いずれも背景画像を画素解析し、イラスト装飾・罫線と重ならない範囲を実測して決めている。
//  - bodySide: 本文の左右マージン。縦は左17.6%まで装飾があるため17%が限界。
//              横は12%まで装飾が無いので広げ、折り返しを減らして文字を大きくする。
//  - logo: 縦は右下がトマト/ワインの大型イラストで空きが無いため「下中央」、
//          横は右下に空きがあるため従来どおり「右下」。いずれも装飾との重なり0%。
//  - bodyTop: 見出し帯直下の飾り罫の下端を実測して決めた値。A縦は17-18%に、
//             横2枚は25-31%に横罫があり、そこを越えた位置から本文を始める。
//             B縦だけは21-31%に飾りが散っているため下げたまま。
//  - bodyBottomWithLogo: ロゴを表示する時だけ本文下端を上げる。ロゴ未選択なら
//             本文が使える高さを削らない（横向きは高さが最も苦しいため）。
const BACKGROUND_LAYOUTS = {
  standard_vertical: {
    headingTop: 4.8, headingHeight: 11, bodyTop: 20, bodyBottom: 78,
    bodyBottomWithLogo: 78, bodySide: 17,
    logo: { right: 40, bottom: 6, height: 11, maxWidth: 20 },
  },
  standard_horizontal: {
    headingTop: 9, headingHeight: 13, bodyTop: 37, bodyBottom: 92,
    bodyBottomWithLogo: 88, bodySide: 12,
    logo: { right: 14, bottom: 4, height: 7, maxWidth: 22 },
  },
  bar_vertical: {
    headingTop: 4.8, headingHeight: 9, bodyTop: 32, bodyBottom: 78,
    bodyBottomWithLogo: 78, bodySide: 17,
    logo: { right: 40, bottom: 6, height: 11, maxWidth: 20 },
  },
  bar_horizontal: {
    headingTop: 10, headingHeight: 13, bodyTop: 33, bodyBottom: 90,
    bodyBottomWithLogo: 88, bodySide: 12,
    logo: { right: 14, bottom: 4, height: 7, maxWidth: 22 },
  },
};

function updateBackground() {
  const orientation = $("#orientation").value; // portrait | landscape
  const design = $("#designSelect").value; // A | B
  const isB = design === "B";
  const orientationKey = orientation === "landscape" ? "horizontal" : "vertical";
  const variantKey = (isB ? "bar_" : "standard_") + orientationKey;
  const file = (isB ? "popo_bar_" : "popo_standard_") + orientationKey + ".jpg";
  $("#previewPage").style.backgroundImage = `url("assets/${file}")`;

  const layout = BACKGROUND_LAYOUTS[variantKey];
  const headingEl = $("#previewHeading");
  const bodyEl = $("#previewBody");
  const page = $("#previewPage");
  headingEl.style.top = layout.headingTop + "%";
  headingEl.style.height = layout.headingHeight + "%";
  const logoShown = Boolean($("#logoSelect").value);
  const bodyBottom = logoShown ? layout.bodyBottomWithLogo : layout.bodyBottom;
  bodyEl.style.top = layout.bodyTop + "%";
  bodyEl.style.bottom = 100 - bodyBottom + "%";
  page.style.setProperty("--body-side", layout.bodySide + "%");
  page.style.setProperty("--logo-right", layout.logo.right + "%");
  page.style.setProperty("--logo-bottom", layout.logo.bottom + "%");
  page.style.setProperty("--logo-height", layout.logo.height + "%");
  page.style.setProperty("--logo-max-width", layout.logo.maxWidth + "%");
}

function updateLogoBadge() {
  const value = $("#logoSelect").value;
  const badge = $("#previewLogoBadge");
  const img = $("#previewLogoImg");
  if (!value) {
    badge.classList.remove("visible");
    img.src = "";
    return;
  }
  img.src = "assets/" + value;
  badge.classList.add("visible");
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

// 必須項目（optional指定のないフィールド）が埋まっているかを確認し、
// 未入力の入力欄には赤枠を付ける。「、、」のような欠落文言のまま印刷されるのを防ぐ。
function validateFields(fmt) {
  let allValid = true;
  if (!fmt) return false;

  fmt.fields.forEach((field) => {
    if (field.optional || field.type === "checkboxGroup") return;

    if (field.type === "dayList") {
      const rows = dayListState[field.key] || [];
      if (!rows.some((r) => r.date)) allValid = false;
      return;
    }

    const el = $("#f_" + field.key);
    if (!el) return;
    let targetEl = el;
    let value = el.value;
    if (field.type === "select" && el.value === "__custom__") {
      const custom = $("#f_" + field.key + "_custom");
      targetEl = custom || el;
      value = custom ? custom.value : "";
    }
    const invalid = !value || !String(value).trim();
    targetEl.classList.toggle("field-invalid", invalid);
    if (invalid) allValid = false;
  });

  return allValid;
}

function updatePrintButtonState() {
  const btn = $("#printBtn");
  const hint = $("#printHint");
  const storeOk = !!$("#storeSelect").value;
  const fieldsOk = validateFields(selectedFormat);
  const ready = storeOk && !!selectedFormat && fieldsOk && !textOverflowing;

  btn.disabled = !ready;

  if (!hint) return;
  if (ready) {
    hint.textContent = "";
  } else if (!storeOk && !selectedFormat) {
    hint.textContent = "店舗とフォーマットを選択してください。";
  } else if (!storeOk) {
    hint.textContent = "店舗を選択してください。";
  } else if (!selectedFormat) {
    hint.textContent = "フォーマットを選択してください。";
  } else if (textOverflowing) {
    hint.textContent = "文章が長すぎて枠に収まりません。本文を短くしてください。";
  } else {
    hint.textContent = "赤枠の必須項目を入力してください。";
  }
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

// 文字サイズの設計値（px）。A4は96dpiで210mm=793px相当なので px×0.2646 が実寸mm。
// 店頭に掲示し1〜2m離れて読むPOPのため、従来の見出し42px/本文24pxから引き上げた。
const HEADING_MAX_SIZE = 56; // 14.8mm / 42pt
const HEADING_MIN_SIZE = 20;
const BODY_MIN_SIZE = 14;
const FIT_STEP = 2; // 1px刻みは知覚できない差でブレるだけなので2px(1.5pt)刻み

// 本文は「短いPOPほど大きく」する。文字数から上限を決めるのは、行数を基準にすると
// 「サイズを決めるのに行数が必要／行数を知るのにサイズが必要」で循環するため。
function bodyCapForLength(len) {
  if (len <= 40) return 44; // 11.6mm
  if (len <= 80) return 40;
  if (len <= 140) return 36;
  return 32; // 8.5mm（従来の24pxより大きい）
}

// 和文は行間を広く取る必要があるが、比率固定のままサイズを上げると行間が開きすぎて
// 段落が塊として見えなくなるため、サイズに応じて行送りを詰める。
function bodyLineHeight(size) {
  if (size >= 36) return 1.5;
  if (size >= 28) return 1.62;
  return 1.75;
}

// 本文を1行ずつ要素に分けて流し込む（text-wrap:balance を段落単位で効かせるため）。
function renderBodyLines(container, text) {
  container.textContent = "";
  text.split("\n").forEach((line) => {
    const el = document.createElement("div");
    el.className = "preview-body-line";
    el.textContent = line;
    container.appendChild(el);
  });
}

// 表示エリアからはみ出す場合、無言で見切れさせず収まるまでフォントサイズを段階的に
// 縮小する（POPとして必ず全文が読める状態を保証する）。逆に文字数が少ない場合は
// 上限まで拡大される。最小サイズまで縮小しても収まらない場合はfalseを返し、
// 呼び出し側で印刷をブロックする。
// box  … 大きさが固定された枠。box.clientHeight が使える高さ
// text … 実際に文字が入る要素。box と同一要素でもよい
function fitTextToBox(box, text, maxSize, minSize, lineHeightFor) {
  if (box.style.display === "none") return true;
  let size = maxSize;
  const apply = () => {
    text.style.fontSize = size + "px";
    if (lineHeightFor) text.style.lineHeight = String(lineHeightFor(size));
  };
  apply();
  while (text.scrollHeight > box.clientHeight + 1 && size > minSize) {
    size = Math.max(minSize, size - FIT_STEP);
    apply();
  }
  return text.scrollHeight <= box.clientHeight + 1;
}

let textOverflowing = false;

function updatePreview() {
  const headingEl = $("#previewHeading");
  const bodyEl = $("#previewBody");
  const bodyTextEl = $("#previewBodyText");

  updateBackground();

  if (!selectedFormat) {
    headingEl.textContent = "";
    headingEl.style.display = "none";
    renderBodyLines(bodyTextEl, "フォーマットを選択すると、ここにプレビューが表示されます。");
    fitTextToBox(bodyEl, bodyTextEl, 32, BODY_MIN_SIZE, bodyLineHeight);
    textOverflowing = false;
    fitPreviewScale();
    updatePrintButtonState();
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
  headingEl.style.display = heading ? "flex" : "none";
  renderBodyLines(bodyTextEl, bodyText);

  // 見出しを先に確定し、そのサイズを本文の上限に反映する。独立に決めると
  // 「本文44px・見出し42px」のように大小関係が逆転して情報の階層が崩れる。
  const headingFit = fitTextToBox(headingEl, headingEl, HEADING_MAX_SIZE, HEADING_MIN_SIZE);
  const headingSize = heading ? parseFloat(headingEl.style.fontSize) : Infinity;
  const bodyCap = Math.max(
    24,
    Math.min(bodyCapForLength(bodyText.replace(/\s/g, "").length), headingSize - 8)
  );
  const bodyFit = fitTextToBox(bodyEl, bodyTextEl, bodyCap, BODY_MIN_SIZE, bodyLineHeight);
  textOverflowing = !headingFit || !bodyFit;
  fitPreviewScale();
  updatePrintButtonState();
}

function mirrorBracket(b) {
  const map = { "〈": "〉", "【": "】", "＜": "＞" };
  return map[b] || "";
}

document.addEventListener("DOMContentLoaded", init);
