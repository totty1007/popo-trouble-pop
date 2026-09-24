// 営業トラブル対応POP フォーマット定義
// 各フォーマットは「見出し」「本文テンプレート」「入力フィールド」を持つ。
// 本文テンプレート中の {{key}} は入力値に置換される。{{storeFull}} は店舗選択から自動生成。

const CHANGE_TYPE_OPTIONS = [
  "通常より閉店時間が早まる場合があります",
  "通常より開店時間が遅くなる場合があります",
  "臨時休業となる場合があります",
  "自由記述",
];

const FORMATS = [
  // ───────────── 天候対応 ─────────────
  {
    id: "weather_advance_notice",
    category: "天候対応",
    title: "事前案内（台風・大雪等で営業時間変更の可能性）",
    bracket: "＜",
    heading: "お知らせ",
    fields: [
      {
        key: "weather",
        label: "事象",
        type: "select",
        options: ["台風", "大雪・積雪", "大雨", "強風", "その他悪天候"],
        default: "台風",
      },
      {
        key: "days",
        label: "対象日と変更内容",
        type: "dayList",
        min: 1,
        max: 3,
        defaultRows: 2,
        rowFields: [
          { key: "date", label: "日付", type: "date" },
          {
            key: "changeType",
            label: "変更内容",
            type: "select",
            options: CHANGE_TYPE_OPTIONS,
          },
          { key: "freeText", label: "自由記述", type: "text", placeholder: "「自由記述」選択時のみ入力" },
        ],
      },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "{{weather}}の影響により営業時間の変更をさせて頂く場合がございます。\n" +
      "{{days}}\n" +
      "当日の天候次第で変更をさせていただきます。\n" +
      "お客様には大変ご迷惑をお掛け致しますが、ご理解、ご協力の程宜しくお願い申し上げます。",
  },
  {
    id: "weather_short_hours",
    category: "天候対応",
    title: "本日の営業時間短縮のお知らせ",
    bracket: "〈",
    heading: "お知らせ",
    fields: [
      {
        key: "reason",
        label: "理由",
        type: "select",
        options: ["台風", "大雪・積雪", "悪天候", "その他"],
        default: "台風",
        allowCustom: true,
      },
      { key: "closeTime", label: "閉店時刻", type: "time" },
      { key: "lastOrderTime", label: "ラストオーダー時刻", type: "time", optional: true },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "{{reason}}の影響により、本日は下記の時間で営業を終了させていただきます。\n" +
      "{{closeTime}}　Close{{lastOrderBlock}}\n" +
      "※食材が無くなり次第、予定より早く閉店する可能性もございます。\n" +
      "お客様には大変ご迷惑をお掛け致しますが、ご理解、ご協力の程宜しくお願い申し上げます。",
  },
  {
    id: "weather_temp_closure",
    category: "天候対応",
    title: "臨時休業のお知らせ",
    bracket: "〈",
    heading: "臨時休業のお知らせ",
    fields: [
      {
        key: "reason",
        label: "理由",
        type: "select",
        options: ["設備機器のトラブル", "台風", "大雪・積雪", "悪天候", "その他"],
        default: "設備機器のトラブル",
        allowCustom: true,
      },
      {
        key: "reopenKnown",
        label: "再開予定",
        type: "select",
        options: ["未定（目途が立ち次第ご案内）", "時刻が分かっている"],
        default: "未定（目途が立ち次第ご案内）",
      },
      { key: "reopenTime", label: "再開予定時刻", type: "time", optional: true },
    ],
    body:
      "いつも、{{storeFull}}をご利用いただき誠にありがとうございます。\n" +
      "{{reason}}により、本日は休業させていただきます。\n" +
      "{{reopenBlock}}\n" +
      "お客様には大変ご迷惑をお掛け致しますが、ご理解、ご協力の程宜しくお願い申し上げます。",
  },
  {
    id: "weather_delayed_open",
    category: "天候対応",
    title: "開店遅延のお知らせ",
    bracket: "〈",
    heading: "開店遅延のお知らせ",
    fields: [
      {
        key: "reason",
        label: "理由",
        type: "select",
        options: ["設備機器のトラブル", "台風", "大雪・積雪", "悪天候", "その他"],
        default: "設備機器のトラブル",
        allowCustom: true,
      },
      {
        key: "reopenKnown",
        label: "営業開始予定",
        type: "select",
        options: ["未定（HP等でご案内）", "時刻が分かっている"],
        default: "未定（HP等でご案内）",
      },
      { key: "reopenTime", label: "営業開始予定時刻", type: "time", optional: true },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "{{reason}}により、現在開店を遅らせていただいております。\n" +
      "{{reopenBlock}}\n" +
      "お客様には大変ご迷惑をお掛け致しますが、ご理解、ご協力の程宜しくお願い申し上げます。",
  },

  // ───────────── 貸切・特別営業 ─────────────
  {
    id: "reserved_business_notice",
    category: "貸切・特別営業",
    title: "貸切営業のお知らせ",
    bracket: "〈",
    heading: "貸切営業のお知らせ",
    fields: [
      {
        key: "patternType",
        label: "パターン",
        type: "select",
        options: [
          "本日は貸切営業のため、通常営業を下記時刻までとさせていただきます",
          "本日は貸切営業のため、通常営業の開始を下記時刻からとさせていただきます",
        ],
      },
      { key: "time1", label: "時刻（閉店 or 開店）", type: "time" },
      { key: "lastOrderTime", label: "ラストオーダー時刻（閉店パターンのみ）", type: "time", optional: true },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "お客様には大変ご迷惑をお掛け致しますが、ご理解・ご協力の程宜しくお願い申し上げます。\n" +
      "{{patternType}}。\n" +
      "{{time1}}{{lastOrderBlock}}\n" +
      "尚、貸切営業の詳細は店頭スタッフまでお尋ねください。",
  },

  // ───────────── 座席・混雑対応 ─────────────
  {
    id: "staff_wait_apology",
    category: "座席・混雑対応",
    title: "スタッフ体制お詫び（ご案内・お料理提供にお時間）",
    bracket: "【",
    heading: "お詫びとお願い",
    fields: [],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "本日はスタッフ体制の都合により、ご案内・お料理のご提供にお時間をいただく場合がございます。\n" +
      "ご不便をおかけし申し訳ございません。何卒ご理解のほどよろしくお願いいたします。",
  },
  {
    id: "stair_queue_guide",
    category: "座席・混雑対応",
    title: "列整理のご案内（階段で並ぶ場合）",
    bracket: "【",
    heading: "列の最後尾は階段です",
    fields: [],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "順番にご案内しております。このまま階段に沿ってお並びの上、お待ちくださいませ。\n" +
      "順次ご案内させていただきます。",
  },
  {
    id: "table_split_rule",
    category: "座席・混雑対応",
    title: "テーブル利用ルール（人数に応じた分割案内）",
    bracket: "【",
    heading: "席のご案内についてのお願い",
    fields: [
      { key: "smallGroupText", label: "少人数の場合の案内文", type: "text", default: "2名様・3名様に分かれて、または4名席にお詰めいただいてのご案内となります。" },
      { key: "smallGroupSize", label: "少人数の基準（〜名様の場合）", type: "text", default: "5" },
      { key: "largeGroupSize", label: "多人数の基準（〜名様以上の場合）", type: "text", default: "6" },
    ],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "当店では消防法に基づく安全管理の観点から、テーブル同士をつなげてご利用いただくことはできません。\n" +
      "恐れ入りますが、以下の通りご案内させていただいております。\n" +
      "{{smallGroupSize}}名様の場合：{{smallGroupText}}\n" +
      "{{largeGroupSize}}名様以上の場合：複数のテーブルに分かれてのご案内となります。\n" +
      "※テーブル同士を隣接してご案内する場合でも、席はおつなぎできません。\n" +
      "また、ウェイティングのお客様がいらっしゃる場合、ご案内後のお席のご移動はご遠慮いただいております。\n" +
      "ご理解とご協力をお願い申し上げます。",
  },
  {
    id: "terrace_seat_change",
    category: "座席・混雑対応",
    title: "テラス席運用変更のお知らせ",
    bracket: "〈",
    heading: "テラス席運用変更のお知らせ",
    fields: [
      {
        key: "reason",
        label: "理由",
        type: "select",
        options: [
          "混雑時のご案内をよりスムーズに行うため",
          "酷暑のため、お客様の安全と快適さを考慮し",
          "荒天のため",
          "その他",
        ],
        allowCustom: true,
      },
    ],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "この度、{{reason}}、テラス席の営業を終了し、ウェイティングスペース専用とさせていただくこととなりました。\n" +
      "お食事でのご利用を楽しみにされていたお客様にはご不便をおかけいたしますが、何卒ご理解賜りますようお願い申し上げます。\n" +
      "引き続き変わらぬご愛顧のほどお願い申し上げます。",
  },
  {
    id: "time_limit_notice",
    category: "座席・混雑対応",
    title: "ご利用時間制限のお知らせ（混雑時○分制）",
    bracket: "【",
    heading: "ご利用時間のお願い",
    fields: [
      { key: "minutes", label: "制限時間（分）", type: "number", default: "60" },
    ],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "より多くのお客様におくつろぎいただくため、混雑時は、{{minutes}}分制とさせていただいております。\n" +
      "また、お会計は席ごとにまとめていただけますと幸いです。\n" +
      "ご理解とご協力の程、よろしくお願いいたします。",
  },

  // ───────────── 決済トラブル ─────────────
  {
    id: "cashless_outage_notice",
    category: "決済トラブル",
    title: "キャッシュレス決済不可のお知らせ",
    bracket: "〈",
    heading: "お客様へ",
    fields: [
      {
        key: "cause",
        label: "原因",
        type: "select",
        options: [
          "決済システムトラブル",
          "ネット不通トラブル",
          "クレジット端末機器故障",
          "停電",
          "その他",
        ],
        allowCustom: true,
      },
      {
        key: "unavailable",
        label: "利用できない決済（複数選択可）",
        type: "checkboxGroup",
        options: ["クレジットカード", "電子マネー", "QRコード決済"],
      },
      {
        key: "available",
        label: "引き続き利用できる決済（該当あれば選択）",
        type: "checkboxGroup",
        options: ["現金", "クレジットカード", "電子マネー", "QRコード決済"],
        default: ["現金"],
      },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "現在、{{cause}}により、{{unavailable}}がご利用いただけない可能性がございます。\n" +
      "{{availableBlock}}\n" +
      "お客様にはご迷惑をお掛けいたしますが、ご理解・ご協力の程宜しくお願い申し上げます。",
  },
  {
    id: "network_trouble_notice",
    category: "決済トラブル",
    title: "ネット回線不具合による決済遅延のお願い",
    bracket: "〈",
    heading: "お客様へ",
    fields: [
      { key: "cause", label: "原因（例：駅前電気工事）", type: "text", default: "周辺の電気工事" },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "{{cause}}の影響により、ネット回線の不具合が生じております。\n" +
      "回線復旧作業が生じた場合、クレジットカード・電子マネーのご利用時に、お時間を頂戴する事がございます。\n" +
      "お客様にはご迷惑をお掛け致しますが、ご理解・ご協力の程宜しくお願い申し上げます。",
  },

  // ───────────── 営業時間・定休日 ─────────────
  {
    id: "hours_change_notice",
    category: "営業時間・定休日",
    title: "営業時間変更のお知らせ（恒久変更）",
    bracket: "〈",
    heading: "営業時間変更のお知らせ",
    fields: [
      { key: "effectiveDate", label: "変更適用日", type: "date" },
      { key: "beforeHours", label: "変更前の営業時間（自由記述・改行可）", type: "textarea", default: "21:30 L.O　22:00 CLOSE" },
      { key: "afterHours", label: "変更後の営業時間（自由記述・改行可）", type: "textarea", default: "21:00 L.O　21:30 CLOSE" },
    ],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "諸般の事情により、{{effectiveDate}}より下記の営業時間に変更させていただきます。\n" +
      "【変更前】\n{{beforeHours}}\n" +
      "【変更後】\n{{afterHours}}\n" +
      "引き続き変わらぬご愛顧のほどお願い申し上げます。",
  },
  {
    id: "regular_holiday_change",
    category: "営業時間・定休日",
    title: "定休日変更のお知らせ",
    bracket: "〈",
    heading: "定休日変更のお知らせ",
    fields: [
      { key: "effectiveDate", label: "変更適用日", type: "date" },
      { key: "newHoliday", label: "新しい定休日", type: "text", default: "毎週水曜日" },
    ],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "諸般の事情により、{{effectiveDate}}より定休日を「{{newHoliday}}」に変更させていただきます。\n" +
      "お客様にはご不便をおかけいたしますが、ご理解の程よろしくお願い申し上げます。",
  },

  // ───────────── メニュー・サービス ─────────────
  {
    id: "service_end_notice",
    category: "メニュー・サービス",
    title: "サービス・割引終了のお知らせ",
    bracket: "〈",
    heading: "サービス終了のお知らせ",
    fields: [
      { key: "serviceName", label: "終了するサービス名", type: "text", default: "レシートクーポンによる各種割引" },
      { key: "endDate", label: "終了時期", type: "text", default: "今月末" },
    ],
    body:
      "いつも、{{storeFull}}をご利用いただき誠にありがとうございます。\n" +
      "この度、誠に勝手ながら「{{serviceName}}」を、{{endDate}}で終了させていただくこととなりました。\n" +
      "これまでのご利用に感謝申し上げます。今後もより良いサービスを提供できるよう努めてまいりますので、引き続きご愛顧のほどよろしくお願いいたします。",
  },
  {
    id: "takeout_end_notice",
    category: "メニュー・サービス",
    title: "テイクアウト販売終了のお知らせ",
    bracket: "〈",
    heading: "テイクアウト終了のお知らせ",
    fields: [
      { key: "endDate", label: "終了時期（例：2025年12月より）", type: "text" },
    ],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "この度、店舗運営体制の見直しに伴い、{{endDate}}テイクアウト販売を終了させていただくこととなりました。\n" +
      "これまでご利用いただいていたお客様にはご不便をおかけいたしますが、何卒ご理解賜りますようお願い申し上げます。\n" +
      "引き続き変わらぬご愛顧のほどお願い申し上げます。",
  },
  {
    id: "menu_partial_stop",
    category: "メニュー・サービス",
    title: "一部商品販売中止のお知らせ（機器故障）",
    bracket: "〈",
    heading: "お客様へ",
    fields: [
      { key: "equipment", label: "故障した機器", type: "text", default: "キッチンオーブン" },
      { key: "items", label: "販売中止となる商品", type: "text", default: "ピザ・トースト・グラタン等" },
    ],
    body:
      "日頃より{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "{{equipment}}の不具合により、{{items}}の販売は一時中止させて頂いております。\n" +
      "お客様にはご迷惑をお掛け致しますが、ご理解・ご協力の程宜しくお願い申し上げます。",
  },
  {
    id: "lunch_time_change",
    category: "メニュー・サービス",
    title: "ランチ提供時間変更のお知らせ",
    bracket: "",
    heading: "ランチセット提供時間変更のお知らせ",
    fields: [
      { key: "effectiveDate", label: "適用開始日", type: "date" },
      { key: "beforeTime", label: "変更前の提供時間", type: "text", default: "11:00〜15:00" },
      { key: "afterTime", label: "変更後の提供時間", type: "text", default: "11:00〜17:00" },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "お客様からのご要望にお応えし、{{effectiveDate}}より、平日ランチセットの提供時間を変更いたします。\n" +
      "【変更前】{{beforeTime}}\n【変更後】{{afterTime}}\n" +
      "皆さまのご来店を心よりお待ちしております。",
  },

  // ───────────── 施設・その他 ─────────────
  {
    id: "smoking_area_notice",
    category: "施設・その他",
    title: "喫煙スペース利用中止・撤去のお知らせ",
    bracket: "〈",
    heading: "お知らせ",
    fields: [
      {
        key: "type",
        label: "内容",
        type: "select",
        options: [
          "受動喫煙防止策の取り組みの一環として、喫煙所を撤去する運びとなりました",
          "荒天のため、当面の間、喫煙スペースのご利用を中止とさせていただきます",
        ],
      },
    ],
    body:
      "いつも、{{storeFull}}をご利用いただき誠にありがとうございます。\n" +
      "{{type}}。\n" +
      "ご利用のお客様には大変ご不便をお掛けいたしますが、ご理解・ご協力の程よろしくお願い申し上げます。",
  },
  {
    id: "free_notice",
    category: "施設・その他",
    title: "汎用お知らせテンプレート（見出し・本文を自由入力）",
    bracket: "〈",
    heading: "",
    fields: [
      { key: "customHeading", label: "見出し", type: "text", default: "お知らせ" },
      {
        key: "customBody",
        label: "本文（改行はそのまま反映されます）",
        type: "textarea",
        default: "",
        rows: 6,
      },
    ],
    body:
      "いつも、{{storeFull}}をご利用頂き誠にありがとうございます。\n" +
      "{{customBody}}\n" +
      "お客様にはご迷惑をお掛け致しますが、ご理解・ご協力の程宜しくお願い申し上げます。",
    dynamicHeading: true,
  },
];
