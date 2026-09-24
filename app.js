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
  { value: "logo_bar_horizontal.jpg", label: "ポポラマーマ_バル（横）" },
  { value: "logo_bar_vertical.jpg", label: "ポポラマーマ_バル（縦）" },
  { value: "logo_choiwa.jpg", label: "和ぱすた ぽぽらまーま" },
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
    emphasizedLines = new Set();
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
//          横は右下に空きがあるため「右下」。いずれも装飾との重なり0%。枠は縦横比で
//          形が変わる（縦向きは横長ロゴ用56%x11%と縦長ロゴ用20%x17%の2種）。
//  - bodyTop: 見出し帯直下の飾り罫の下端を実測して決めた値。A縦は17-18%に、
//             横2枚は25-31%に横罫があり、そこを越えた位置から本文を始める。
//             B縦だけは21-31%に飾りが散っているため下げたまま。
//  - bodyBottomWithLogo: ロゴを表示する時だけ本文下端を上げる。ロゴ未選択なら
//             本文が使える高さを削らない（横向きは高さが最も苦しいため）。
// 本文には「ブランド名＋店舗名」がそのまま印字される。既定は区切りなしだが
// （例: ポポラマーマ + 葛西店 → ポポラマーマ葛西店）、正式店名に全角スペースが
// 入るブランドがあるため、ここで区切り文字を明示する。
// 公式サイト(popolamama.com/restaurant)の店舗一覧は「ポポラマーマ　葛西駅前店」
// のようにブランド名と店舗名を全角スペースで区切っている。POPに印字する店名は
// 客向けの正式表記に合わせる。
const BRAND_SEPARATOR = {
  "ポポラマーマ": "　",
  "ポポラマーマ_バル": "　",
  "和ぱすた　ぽぽらまーま": "　",
};

const BACKGROUND_LAYOUTS = {
  standard_vertical: {
    headingTop: 4.8, headingHeight: 11, bodyTop: 20, bodyBottom: 78,
    bodyBottomWithLogo: 78, bodySide: 17,
    logo: { anchor: "center", bottom: 10, maxWidth: 56, maxHeight: 11,
            tall: { anchor: "center", bottom: 4, maxWidth: 20, maxHeight: 17 } },
  },
  standard_horizontal: {
    headingTop: 9, headingHeight: 13, bodyTop: 37, bodyBottom: 92,
    bodyBottomWithLogo: 88, bodySide: 12,
    logo: { anchor: "right", right: 13, bottom: 4, maxWidth: 74, maxHeight: 16 },
  },
  bar_vertical: {
    headingTop: 4.8, headingHeight: 9, bodyTop: 32, bodyBottom: 78,
    bodyBottomWithLogo: 78, bodySide: 17,
    logo: { anchor: "center", bottom: 10, maxWidth: 56, maxHeight: 11,
            tall: { anchor: "center", bottom: 4, maxWidth: 20, maxHeight: 17 } },
  },
  bar_horizontal: {
    headingTop: 10, headingHeight: 13, bodyTop: 33, bodyBottom: 90,
    bodyBottomWithLogo: 88, bodySide: 12,
    logo: { anchor: "right", right: 13, bottom: 4, maxWidth: 74, maxHeight: 16 },
  },
  // デザインC（フォーマル）は背景に白い見出し帯・本文枠が描かれているため、
  // 文字は必ず枠の内側に収める。本文枠はGemini原画より下へ延ばしてある（隅の唐草飾りから
  // 横1%以上離れる所まで）。枠の実測: 縦=見出し11.6-17.7% 本文23.8-89.5% 左右11.6%、
  // 横=見出し14.6-22.7% 本文30.7-88.0% 左右8.9%。ロゴは本文枠の内側下部に置く。
  formal_vertical: {
    headingTop: 12, headingHeight: 5.3, headingSide: 14, bodyTop: 25, bodyBottom: 88.3,
    bodyBottomWithLogo: 88.3, bodySide: 13,
    logo: { anchor: "center", bottom: 11.5, maxWidth: 50, maxHeight: 8 },
  },
  formal_horizontal: {
    headingTop: 15, headingHeight: 7.4, headingSide: 11, bodyTop: 32, bodyBottom: 86.8,
    bodyBottomWithLogo: 86.8, bodySide: 10.3,
    logo: { anchor: "right", right: 10.3, bottom: 13, maxWidth: 35, maxHeight: 10 },
  },
};

const DESIGN_PREFIX = { A: "standard", B: "bar", C: "formal" };

function updateBackground() {
  const orientation = $("#orientation").value; // portrait | landscape
  const design = $("#designSelect").value; // A | B | C
  const orientationKey = orientation === "landscape" ? "horizontal" : "vertical";
  const variantKey = (DESIGN_PREFIX[design] || "standard") + "_" + orientationKey;
  $("#previewPage").style.backgroundImage = `url("assets/popo_${variantKey}.jpg")`;

  const layout = BACKGROUND_LAYOUTS[variantKey];
  const headingEl = $("#previewHeading");
  const bodyEl = $("#previewBody");
  const page = $("#previewPage");
  headingEl.style.top = layout.headingTop + "%";
  headingEl.style.height = layout.headingHeight + "%";
  const headingSide = (layout.headingSide ?? 12) + "%";
  headingEl.style.left = headingSide;
  headingEl.style.right = headingSide;
  const logoBox = layoutLogoBadge(page, layout);
  const bodyBottom = logoBox
    ? Math.min(layout.bodyBottomWithLogo, logoBox.topPercent - 1)
    : layout.bodyBottom;
  bodyEl.style.top = layout.bodyTop + "%";
  bodyEl.style.bottom = 100 - bodyBottom + "%";
  page.style.setProperty("--body-side", layout.bodySide + "%");
}

// ロゴ枠の大きさは「縦横比が違っても見た目の大きさが揃う」ようにする。
// 枠の形を固定すると、横長ロゴ(比4.5)は高さが、縦長ロゴ(比0.64)は幅が潰れて
// 最大4倍もの差が出るため、目標面積から縦横を逆算し、装飾なし領域に収まるよう
// クランプする。戻り値はロゴ枠の上端位置(%)で、本文下端の計算に使う。
const LOGO_TARGET_AREA = 12000; // px^2 (A4を96dpiとしたページ座標)
const LOGO_TALL_RATIO = 1.5; // これ未満を「縦長」として別枠に切り替える

function layoutLogoBadge(page, layout) {
  const badge = $("#previewLogoBadge");
  const img = $("#previewLogoImg");
  if (!$("#logoSelect").value || !img.naturalWidth || !img.naturalHeight) {
    return null;
  }
  const ratio = img.naturalWidth / img.naturalHeight;
  const region = ratio < LOGO_TALL_RATIO && layout.logo.tall ? layout.logo.tall : layout.logo;
  const pw = page.offsetWidth;
  const ph = page.offsetHeight;
  const pad = 16; // .preview-logo-badge の padding 8px × 2
  const maxW = (pw * region.maxWidth) / 100 - pad;
  const maxH = (ph * region.maxHeight) / 100 - pad;

  let h = Math.sqrt(LOGO_TARGET_AREA / ratio);
  let w = h * ratio;
  if (w > maxW) { w = maxW; h = w / ratio; }
  if (h > maxH) { h = maxH; w = h * ratio; }

  const boxW = w + pad;
  const boxH = h + pad;
  badge.style.width = boxW + "px";
  badge.style.height = boxH + "px";
  badge.style.bottom = (ph * region.bottom) / 100 + "px";
  if (region.anchor === "right") {
    badge.style.right = (pw * region.right) / 100 + "px";
    badge.style.left = "auto";
  } else {
    badge.style.left = (pw - boxW) / 2 + "px";
    badge.style.right = "auto";
  }
  return { topPercent: 100 - region.bottom - (boxH / ph) * 100 };
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
  // ロゴ枠の大きさは画像の縦横比から決めるため、読み込み完了後に再計算する。
  // （naturalWidthが0のまま採寸すると枠が潰れる）
  img.onload = () => updatePreview();
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

function getStoreBrand() {
  const sel = $("#storeSelect");
  if (!sel.value) return "";
  const opt = sel.selectedOptions[0];
  return opt ? opt.dataset.brand : "ポポラマーマ";
}

function getStoreFull() {
  const sel = $("#storeSelect");
  if (!sel.value) return "各店舗";
  const brand = getStoreBrand();
  return brand + (BRAND_SEPARATOR[brand] || "") + sel.value;
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

// 「特に伝えたい内容」の強調。置換した値を制御文字で囲んでおき、描画時にspanへ変える。
// 本文は textContent で流し込むため、HTMLを混ぜずに範囲を持ち回せる方法が必要。
const EM_OPEN = "\u0001";
const EM_CLOSE = "\u0002";
// 店舗が入力した「時刻・日付・数値」は、そのPOPで一番伝えたい事実なので既定で強調する。
const AUTO_EMPHASIS_TYPES = ["time", "date", "number"];

function em(v) {
  return v ? EM_OPEN + v + EM_CLOSE : v;
}

function stripEm(text) {
  return text.split(EM_OPEN).join("").split(EM_CLOSE).join("");
}

let autoEmphasis = true; // 数値の自動強調（店舗側で解除可能）
let emphasizedLines = new Set(); // 行ごと強調に指定された行（強調記号を除いた本文で保持）

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
          return `・${em(formatDateJp(r.date))}　${change}`;
        });
      values[field.key] = lines.join("\n");
    } else {
      const v = getFieldValue(field);
      values[field.key] =
        autoEmphasis && AUTO_EMPHASIS_TYPES.includes(field.type) ? em(v) : v;
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
  if (len <= 40) return 48; // 12.7mm
  if (len <= 80) return 44;
  if (len <= 140) return 40;
  return 36; // 9.5mm
}

// 和文は行間を広く取る必要があるが、比率固定のままサイズを上げると行間が開きすぎて
// 段落が塊として見えなくなるため、サイズに応じて行送りを詰める。
// 2026-09-24に文字を大きくするため1段ずつ詰めた（旧: 1.5 / 1.62 / 1.75）。
function bodyLineHeight(size) {
  if (size >= 36) return 1.4;
  if (size >= 28) return 1.5;
  return 1.6;
}

// ===== 日本語の改行位置の制御 =====
// 既定の折り返しは和文のどこでも改行するため、「本日 / は」「終 / 了」のように
// 文節や熟語の途中で切れる。CSS側を word-break: keep-all にして自動改行を止め、
// ここで入れた改行可能位置(U+200B)だけで改行させる。
// ただし keep-all でも「数字↔和文」の境界は改行されてしまうので（「90 / 分制」）、
// そこには結合子(U+2060)を入れて改行を禁止する。
const ZWSP = "​"; // U+200B 改行してよい位置
const WJ = "⁠"; // U+2060 改行してはいけない位置
const RE_HIRAGANA = /[ぁ-ゖ]/;
// 語頭になりうる文字（漢字・カタカナ・英数字・開き括弧）
const RE_WORD_START = /[一-鿿々ァ-ヺｦ-ﾝ0-9０-９A-Za-zＡ-Ｚａ-ｚ「『（【〈《]/;
// 行頭に置いてはいけない文字（句読点・閉じ括弧・長音符・繰返し記号・小書き）
const RE_NO_LINE_START = /[、。，．！？：；」』）】〉》・…ー〜～々ゝゞぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]/;
// この文字の直後は改行してよい（句読点・閉じ括弧・中黒）
const RE_BREAK_AFTER = /[、。，．！？：；」』）】・]/;
// 接頭の「ご」「お」「御」の直後で切ると「ご|理解」「お|願い」になるので禁止する
const RE_HONORIFIC = /[ごお御]/;
// 補助動詞・丁寧表現の前は文節の切れ目として改行してよい
const AUX_HEADS = ["いただ", "くださ", "ござい", "おり", "いたし", "まいり", "申し"];
// 複合動詞の後項。ここで切ると「申し／上げます」のように動詞が分断される
const COMPOUND_TAILS = ["上げ", "上が", "下げ", "合わせ", "込み", "直し", "出し"];
// 数量＋単位（90分・9月・5名）や英字＋カタカナ語（QRコード）を分断しないための判定
const RE_LATIN_NUM = /[0-9０-９A-Za-zＡ-Ｚａ-ｚ]/;
const RE_JP = /[一-鿿々ぁ-ゖァ-ヺ]/;
const RE_KANJI = /[一-鿿々]/;

function mustJoinBefore(prev, ch) {
  // 「90|分」「QR|コード」の向きだけを禁止する。逆向き（「は|19:00」）は
  // 文節の切れ目なので改行を許す。
  return RE_LATIN_NUM.test(prev) && RE_JP.test(ch);
}

function canBreakBefore(text, i) {
  const prev = text[i - 1];
  const ch = text[i];
  if (RE_NO_LINE_START.test(ch)) return false; // 行頭禁則
  if (COMPOUND_TAILS.some((w) => text.startsWith(w, i))) return false;
  // 「・9月15日（火）」のような箇条書きの先頭の中黒は、行末に取り残さない
  if (prev === "・" && i === 1) return false;
  if (RE_BREAK_AFTER.test(prev)) return true; // 句読点・中黒の後は切れる
  if (!RE_HIRAGANA.test(prev)) return false; // 熟語・カタカナ語の途中では切らない
  if (RE_HONORIFIC.test(prev)) return false; // 「ご|理解」「お|願い」を防ぐ
  if (RE_WORD_START.test(ch)) return true; // ひらがな→語頭 は文節の切れ目
  // 接頭語「ご」「お」「御」＋漢字 は語頭なので、その前では改行してよい
  // （「つなげて|ご利用いただく」。これを許さないと1語が長くなり文字が縮む）
  if (RE_HONORIFIC.test(ch) && RE_KANJI.test(text[i + 1] || "")) return true;
  return AUX_HEADS.some((w) => text.startsWith(w, i));
}

// 1行分のテキストに改行可能位置と結合子を埋め込む。
// 強調用の制御文字は位置を保ったまま透過させ、前後の文字判定には含めない。
function annotateLine(line) {
  const plain = stripEm(line);
  let out = "";
  let idx = 0;
  for (const ch of line) {
    if (ch === EM_OPEN || ch === EM_CLOSE) {
      out += ch;
      continue;
    }
    if (idx > 0) {
      const prev = plain[idx - 1];
      if (mustJoinBefore(prev, ch)) out += WJ;
      else if (canBreakBefore(plain, idx)) out += ZWSP;
    }
    out += ch;
    idx++;
  }
  return out;
}

// 改行できない最長のかたまりの全角換算文字数
function longestSegmentEm(text) {
  let max = 0;
  annotateLine(text)
    .split(/[​\s]+/)
    .forEach((seg) => {
      let width = 0;
      for (const ch of seg) {
        if (ch === WJ || ch === EM_OPEN || ch === EM_CLOSE) continue;
        width += /[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1;
      }
      if (width > max) max = width;
    });
  return max;
}

// 「1語が行幅に収まらないフォントサイズは選ばない」ための概算上限。
// 実際のはみ出しは overflowsBox() が幅でも判定するので、これは初期値の目安。
const LETTER_SPACING_FACTOR = 1.03; // letter-spacing 0.02em 分の余裕

function widthCapFor(text, boxWidth) {
  const seg = longestSegmentEm(text);
  if (!seg || !boxWidth) return Infinity;
  return Math.floor(boxWidth / (seg * LETTER_SPACING_FACTOR));
}

// 本文を1行ずつ要素に分けて流し込む（text-wrap:balance を段落単位で効かせるため）。
// ブランド名（keepTogether）は途中で改行させない。「和ぱすた　ぽぽらまーま」が
// 「ぽぽらまー／ま」と分断されるのを防ぐ。ブランド名と店舗名の間の全角スペースでの
// 改行は許すので、店舗名まで含めて丸ごと1行に追い出すことはしない。
function renderBodyLines(container, text, keepTogether) {
  container.textContent = "";
  text.split("\n").forEach((line) => {
    const el = document.createElement("div");
    el.className = "preview-body-line";
    // 行ごと強調に指定された行は行全体を赤字にし、値だけの部分強調は打ち消す
    if (emphasizedLines.has(stripEm(line))) {
      el.classList.add("em-line");
      appendPlain(el, annotateLine(stripEm(line)), keepTogether);
    } else {
      appendWithEmphasis(el, annotateLine(line), keepTogether);
    }
    container.appendChild(el);
  });
}

// ブランド名だけ改行禁止のspanに包みつつ、テキストノードとして流し込む
function appendPlain(el, text, keepTogether) {
  if (keepTogether && text.includes(keepTogether)) {
    text.split(keepTogether).forEach((part, i) => {
      if (i > 0) {
        const span = document.createElement("span");
        span.className = "nowrap";
        span.textContent = keepTogether;
        el.appendChild(span);
      }
      if (part) el.appendChild(document.createTextNode(part));
    });
  } else if (text) {
    el.appendChild(document.createTextNode(text));
  }
}

// EM_OPEN〜EM_CLOSE で囲まれた範囲を強調spanにして流し込む
function appendWithEmphasis(el, line, keepTogether) {
  let rest = line;
  for (;;) {
    const open = rest.indexOf(EM_OPEN);
    if (open < 0) {
      appendPlain(el, rest, keepTogether);
      return;
    }
    appendPlain(el, rest.slice(0, open), keepTogether);
    const close = rest.indexOf(EM_CLOSE, open + 1);
    const span = document.createElement("span");
    span.className = "em";
    span.textContent = close < 0 ? rest.slice(open + 1) : rest.slice(open + 1, close);
    el.appendChild(span);
    if (close < 0) return;
    rest = rest.slice(close + 1);
  }
}

// 「強調する行」の指定UI。本文の行が入力で変わるため毎回組み直すが、
// 指定は行テキストで保持しているので該当行が残っていればチェックも残る。
function buildEmphasisControls(bodyText) {
  const box = $("#emphasisControls");
  box.textContent = "";
  if (!selectedFormat) return;

  const label = document.createElement("label");
  label.textContent = "④ 強調する行（任意）";
  box.appendChild(label);

  const autoWrap = document.createElement("label");
  autoWrap.className = "emphasis-item";
  const autoCb = document.createElement("input");
  autoCb.type = "checkbox";
  autoCb.checked = autoEmphasis;
  autoCb.addEventListener("change", () => {
    autoEmphasis = autoCb.checked;
    updatePreview();
  });
  const autoText = document.createElement("span");
  autoText.className = "text";
  autoText.textContent = "入力した時刻・日付・数値を赤字にする";
  autoWrap.appendChild(autoCb);
  autoWrap.appendChild(autoText);
  box.appendChild(autoWrap);

  const list = document.createElement("div");
  list.className = "emphasis-list";
  const seen = new Set();
  bodyText.split("\n").forEach((line) => {
    const plain = stripEm(line);
    if (!plain.trim() || seen.has(plain)) return;
    seen.add(plain);
    const item = document.createElement("label");
    item.className = "emphasis-item";
    if (autoEmphasis && line.includes(EM_OPEN)) item.classList.add("is-auto");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = emphasizedLines.has(plain);
    cb.addEventListener("change", () => {
      if (cb.checked) emphasizedLines.add(plain);
      else emphasizedLines.delete(plain);
      updatePreview();
    });
    const text = document.createElement("span");
    text.className = "text";
    text.textContent = plain;
    item.appendChild(cb);
    item.appendChild(text);
    list.appendChild(item);
  });
  box.appendChild(list);
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
  while (overflowsBox(box, text) && size > minSize) {
    size = Math.max(minSize, size - FIT_STEP);
    apply();
  }
  // 上限が奇数（幅や見出しから決まる値）だと「39→37→35」と2px刻みで下がり、
  // 収まるはずの36pxを飛ばしてしまう。1px戻して収まるならそちらを採る。
  if (size < maxSize && !overflowsBox(box, text)) {
    size += 1;
    apply();
    if (overflowsBox(box, text)) {
      size -= 1;
      apply();
    }
  }
  return !overflowsBox(box, text);
}

// 高さだけでなく幅もはみ出し判定に含める。word-break: keep-all にしているため
// 改行できないかたまり（と字間の加算分）が行幅を超えると、折り返されずに
// 横へ溢れて見切れる。幅も見てフォントサイズを下げる必要がある。
function overflowsBox(box, text) {
  return (
    text.scrollHeight > box.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1
  );
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
    buildEmphasisControls("");
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
  const headingText = heading ? `${bracket}${heading}${mirrorBracket(bracket)}` : "";
  headingEl.textContent = annotateLine(headingText);
  headingEl.style.display = heading ? "flex" : "none";
  renderBodyLines(bodyTextEl, bodyText, getStoreBrand());
  buildEmphasisControls(bodyText);

  // 見出しを先に確定し、そのサイズを本文の上限に反映する。独立に決めると
  // 「本文44px・見出し42px」のように大小関係が逆転して情報の階層が崩れる。
  const headingMax = Math.min(
    HEADING_MAX_SIZE,
    widthCapFor(headingText, headingEl.clientWidth)
  );
  const headingFit = fitTextToBox(headingEl, headingEl, headingMax, HEADING_MIN_SIZE);
  const headingSize = heading ? parseFloat(headingEl.style.fontSize) : Infinity;

  const plainBody = stripEm(bodyText);
  let bodyCap = Math.min(bodyCapForLength(plainBody.replace(/\s/g, "").length), headingSize - 8);
  bodyCap = Math.max(bodyCap, 24); // 見出し連動で小さくしすぎない
  bodyCap = Math.min(bodyCap, widthCapFor(plainBody, bodyEl.clientWidth));
  bodyCap = Math.max(bodyCap, BODY_MIN_SIZE);
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
