export const PremiumEmoji = {
  THUMBS_UP: { id: "5337325218442539662", fallback: "👍" },
  NERD: { id: "5870529529746822783", fallback: "🤓" },
  SERVICE_CELEBRATE: { id: "5429299486365092945", fallback: "🎉" },
  SERVICE_ACTIVE: { id: "5427240466158487770", fallback: "🍿" },
  SERVICE_PANEL_BTN: { id: "5429394241933572494", fallback: "😍" },
  SERVICE_OUTBOUND_BTN: { id: "5427176574224991387", fallback: "😐" },
  OUTBOUND_PAYMENT_TITLE: { id: "5426987243476649409", fallback: "😐" },
  VOLUME_PACKAGE: { id: "5427102142441751710", fallback: "🚶‍♂️" },
  VOLUME_PACKAGE_BTN: { id: "5426871906424885531", fallback: "😏" },
  PAY_AS_YOU_GO_BTN: { id: "5427357065930640637", fallback: "😏" },
  PANEL_TRIAL_BTN: { id: "5429318491595376439", fallback: "🗿" },
  VOLUME_INCREASE: { id: "5361722625548633513", fallback: "➕" },
  VOLUME_DECREASE: { id: "5364322626950938114", fallback: "➖" },
  OCTOPUS: { id: "5922735252366693072", fallback: "🐙" },
  NEW_SERVICE: { id: "5920476357267034346", fallback: "🥹" },
  MANAGE_SERVICES: { id: "5429500104287488046", fallback: "📝" },
  WALLET: { id: "5429404236322476731", fallback: "💵" },
  SUPPORT: { id: "5429581901939638052", fallback: "🤓" },
  FAQ: { id: "5922326624883184314", fallback: "🐙" },
  BACK_MENU: { id: "5429289410371815433", fallback: "😵" },
  CANCEL: { id: "5427126121244166618", fallback: "😢" },
  SUBSCRIPTION_BUILDING: { id: "5429623567417377644", fallback: "☎️" },
  SUBSCRIPTION_ADDRESS_TIP: { id: "5922472408958112850", fallback: "🐿" },
  SUBSCRIPTION_LOCATION_TIP: { id: "5922514924839376285", fallback: "🐙" },
  OUTBOUND_USAGE_ACTIVATE: { id: "5866225658983617570", fallback: "😈" },
  OUTBOUND_USAGE_SUSPEND: { id: "5868250478365643940", fallback: "😴" },
  ADMIN_PANEL: { id: "5429537552107342416", fallback: "💪" },
  USER_STATS: { id: "5427339194571720355", fallback: "😐" },
  STATS_TITLE: { id: "5866400696080798079", fallback: "😋" },
  STATS_DESC: { id: "5769172673837931281", fallback: "🪨" },
  STATS_UPDATED: { id: "5866498273442795866", fallback: "😑" },
  PAYMENT_TITLE: { id: "5429404236322476731", fallback: "💵" },
  PAYMENT_TRON: { id: "5391362525570833369", fallback: "🤩" },
  RIAL_TOPUP_TITLE: { id: "5429387271201654734", fallback: "👫" },
  RIAL_CARD: { id: "5922735252366693072", fallback: "🐙" },
  RIAL_SHEBA: { id: "5870653701546317297", fallback: "🤪" },
  RIAL_RECEIPT: { id: "5429604446222980121", fallback: "😊" },
  RIAL_NOTIFY: { id: "5429103622971492403", fallback: "👍" },
  WALLET_HEADER: { id: "5922596013821923909", fallback: "🐙" },
  WALLET_BALANCE: { id: "5427357065930640637", fallback: "😏" },
  WALLET_TOP_UP: { id: "5429108450514733120", fallback: "🙏" },
  TOPUP_METHOD_TITLE: { id: "5429555423466260021", fallback: "👏" },
  TOPUP_METHOD_CHOOSE: { id: "5922312653354570470", fallback: "😒" },
  TOPUP_BTN_TRON: { id: "5866400696080798079", fallback: "😋" },
  TOPUP_BTN_CARD: { id: "5920238987309486424", fallback: "😆" },
  TOPUP_TITLE: { id: "5920476357267034346", fallback: "🥹" },
  TOPUP_DESC: { id: "5427051032330931972", fallback: "😑" },
  TOPUP_ADDRESS: { id: "5391362525570833369", fallback: "🤩" },
  TOPUP_CONFIRM: { id: "5429306134974461970", fallback: "⌚️" },
  DEPOSIT_SUCCESS: { id: "5922332225520538011", fallback: "😈" },
  DEPOSIT_TRX: { id: "5771451974327212214", fallback: "🪨" },
  DEPOSIT_IRT: { id: "5769172673837931281", fallback: "🪨" },
  DEPOSIT_BALANCE: { id: "5429180971037524427", fallback: "😑" },
  DEPOSIT_FOOTER: { id: "5870895864687366844", fallback: "🤔" },
  DEPOSIT_TX_BTN: { id: "5429582224062189247", fallback: "😑" },
  INVALID_CONFUSED: { id: "5870523877569860653", fallback: "🥴" },
  INVALID_THINKING: { id: "5870895864687366844", fallback: "🤔" },
  INVALID_SLEEPY: { id: "5334586781654346758", fallback: "😴" },
};

export const INVALID_MESSAGE_EMOJIS = [
  PremiumEmoji.INVALID_CONFUSED,
  PremiumEmoji.INVALID_THINKING,
  PremiumEmoji.INVALID_SLEEPY,
];

const ADMIN_FALLBACK = "🌟";

/** Premium emoji set for admin panel UI */
export const AdminEmoji = {
  PANEL: { id: "6143340110017465395", fallback: ADMIN_FALLBACK },
  USER_STATS: { id: "6141081786148457534", fallback: ADMIN_FALLBACK },
  PAYMENT: { id: "6143081346827817116", fallback: ADMIN_FALLBACK },
  SERVERS: { id: "6143186453267483572", fallback: ADMIN_FALLBACK },
  CHANNELS: { id: "6143180848335163142", fallback: ADMIN_FALLBACK },
  BACK: { id: "6143017377584910087", fallback: ADMIN_FALLBACK },
  REFRESH: { id: "6143248176242495024", fallback: ADMIN_FALLBACK },
  TITLE: { id: "6143444061110931085", fallback: ADMIN_FALLBACK },
  DESC: { id: "6143182892739596149", fallback: ADMIN_FALLBACK },
  CONFIRM: { id: "6143292878262112568", fallback: ADMIN_FALLBACK },
  TRON: { id: "6143250392445619284", fallback: ADMIN_FALLBACK },
  RIAL: { id: "6142943164845002023", fallback: ADMIN_FALLBACK },
  CARD: { id: "6143061254970805068", fallback: ADMIN_FALLBACK },
  SHEBA: { id: "6141102934567423868", fallback: ADMIN_FALLBACK },
  ADD: { id: "6141141769661713600", fallback: ADMIN_FALLBACK },
  LIST: { id: "6140921777141845424", fallback: ADMIN_FALLBACK },
  STATUS: { id: "6143104183168929199", fallback: ADMIN_FALLBACK },
  PREMIUM: { id: "6140939755874945986", fallback: ADMIN_FALLBACK },
  TODAY: { id: "6143076167097257048", fallback: ADMIN_FALLBACK },
  WEEK: { id: "6143439237862657090", fallback: ADMIN_FALLBACK },
  MONTH: { id: "6143244375196437933", fallback: ADMIN_FALLBACK },
  TIME: { id: "6140966479161461806", fallback: ADMIN_FALLBACK },
  PORT: { id: "6143090366259137425", fallback: ADMIN_FALLBACK },
  CONNECTION: { id: "6143324098379386422", fallback: ADMIN_FALLBACK },
  ACTIVE: { id: "6143078344645677424", fallback: ADMIN_FALLBACK },
  SALES: { id: "6143206553714430069", fallback: ADMIN_FALLBACK },
  RENEWAL: { id: "6143316968733674499", fallback: ADMIN_FALLBACK },
  DELETE: { id: "6140697197596904691", fallback: ADMIN_FALLBACK },
  EDIT: { id: "6140896277921008853", fallback: ADMIN_FALLBACK },
  DETAIL: { id: "6143435801888819710", fallback: ADMIN_FALLBACK },
  TRAFFIC: { id: "6141175910356751194", fallback: ADMIN_FALLBACK },
  UPLOAD: { id: "6143404676260826553", fallback: ADMIN_FALLBACK },
  DOWNLOAD: { id: "6140920754939628983", fallback: ADMIN_FALLBACK },
  NEXT: { id: "6141129786702957775", fallback: ADMIN_FALLBACK },
  PREV: { id: "6143074045383414214", fallback: ADMIN_FALLBACK },
  MASTER: { id: "6143013507819375658", fallback: ADMIN_FALLBACK },
  SETTINGS: { id: "6143397976111844892", fallback: ADMIN_FALLBACK },
  NOTIFY: { id: "6143180848335163142", fallback: ADMIN_FALLBACK },
};

export const ADMIN_EMOJI_POOL = Object.values(AdminEmoji);

export const STATS_EMOJI_POOL = [
  { id: "5393244193692881663", fallback: "🤩" },
  { id: "5391020719188513871", fallback: "🤩" },
  { id: "5391282428725729430", fallback: "🤩" },
  { id: "5390923485423901349", fallback: "🤩" },
  { id: "5391111884164339107", fallback: "🤩" },
  { id: "5391362525570833369", fallback: "🤩" },
  { id: "5391268044880255688", fallback: "🤩" },
];

export function premiumEmoji({ id, fallback }) {
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

export function adminEmoji({ id, fallback = ADMIN_FALLBACK }) {
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

export function pickRandomStatsEmoji() {
  const emoji =
    STATS_EMOJI_POOL[Math.floor(Math.random() * STATS_EMOJI_POOL.length)];
  return emoji.id;
}

export function pickRandomInvalidMessageEmoji() {
  return INVALID_MESSAGE_EMOJIS[
    Math.floor(Math.random() * INVALID_MESSAGE_EMOJIS.length)
  ];
}
