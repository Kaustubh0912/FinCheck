import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon, type FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import {
  // accounts / money
  faBuildingColumns, faMoneyBillWave, faCreditCard, faWallet, faChartLine, faBox,
  faPiggyBank, faMoneyBill, faSackDollar, faCoins, faBuilding, faBriefcase,
  // expense categories
  faUtensils, faCartShopping, faCar, faBagShopping, faFileInvoiceDollar, faHouse,
  faHeartPulse, faFilm, faGraduationCap, faTag, faGift, faPlane, faBus, faTrain,
  faMugHot, faGamepad, faDumbbell, faGasPump, faPhone, faWifi, faShirt, faBaby, faPaw,
  // UI chrome
  faReceipt, faGear, faPlus, faXmark, faArrowRight, faTrash, faArrowRightArrowLeft,
  faBoxArchive, faRightFromBracket, faMoon, faSun, faDownload, faPencil,
  faChevronLeft, faChevronRight, faChevronDown, faCheck, faArrowTrendUp, faArrowTrendDown, faIndianRupeeSign,
  faMagnifyingGlass, faLock, faGripVertical, faMinus, faCircleCheck, faCircleXmark,
  faArrowUp, faArrowDown, faScissors, faEquals, faSliders, faKeyboard,
} from "@fortawesome/free-solid-svg-icons";

/** Every icon the app can render, keyed by a short stable slug. */
const ICONS: Record<string, IconDefinition> = {
  // accounts / money
  bank: faBuildingColumns, cash: faMoneyBillWave, card: faCreditCard, wallet: faWallet,
  invest: faChartLine, box: faBox, piggy: faPiggyBank, money: faMoneyBill,
  sack: faSackDollar, coins: faCoins, building: faBuilding, briefcase: faBriefcase,
  // expense / income categories
  utensils: faUtensils, cart: faCartShopping, car: faCar, bag: faBagShopping,
  bills: faFileInvoiceDollar, house: faHouse, health: faHeartPulse, film: faFilm,
  education: faGraduationCap, tag: faTag, gift: faGift, plane: faPlane, bus: faBus,
  train: faTrain, coffee: faMugHot, game: faGamepad, gym: faDumbbell, fuel: faGasPump,
  phone: faPhone, wifi: faWifi, shirt: faShirt, baby: faBaby, pet: faPaw,
  // UI chrome
  home: faHouse, activity: faReceipt, settings: faGear, plus: faPlus, close: faXmark,
  "arrow-right": faArrowRight, trash: faTrash, transfer: faArrowRightArrowLeft,
  archive: faBoxArchive, logout: faRightFromBracket, moon: faMoon, sun: faSun,
  download: faDownload, edit: faPencil, "chevron-left": faChevronLeft,
  "chevron-right": faChevronRight, "chevron-down": faChevronDown, check: faCheck,
  "trend-up": faArrowTrendUp, "trend-down": faArrowTrendDown, rupee: faIndianRupeeSign,
  search: faMagnifyingGlass, lock: faLock, "grip-vertical": faGripVertical, minus: faMinus,
  "circle-check": faCircleCheck, "circle-xmark": faCircleXmark,
  "arrow-up": faArrowUp, "arrow-down": faArrowDown, "arrow-right-arrow-left": faArrowRightArrowLeft,
  scissors: faScissors, equals: faEquals, sliders: faSliders, keyboard: faKeyboard,
};
/* eslint-disable react-refresh/only-export-components */

/** Maps legacy emoji values (older DB rows) to the new icon slugs. */
const EMOJI_TO_KEY: Record<string, string> = {
  "🏦": "bank", "💵": "cash", "💳": "card", "👛": "wallet", "📈": "invest", "📊": "invest",
  "📦": "box", "💼": "briefcase", "🏢": "building", "🎁": "gift", "➕": "coins", "💰": "sack",
  "🍽️": "utensils", "🛒": "cart", "🚗": "car", "🛍️": "bag", "💡": "bills", "🏠": "house",
  "🩺": "health", "🎬": "film", "📚": "education", "🔖": "tag", "🏷️": "tag",
};

export function resolveIcon(name?: string | null): IconDefinition {
  if (!name) return faTag;
  if (ICONS[name]) return ICONS[name];
  const mapped = EMOJI_TO_KEY[name];
  if (mapped && ICONS[mapped]) return ICONS[mapped];
  return faTag;
}

/** Render any registered icon by slug (falls back to a tag icon). */
export function Icon({ name, ...rest }: { name?: string | null } & Omit<FontAwesomeIconProps, "icon">) {
  return <FontAwesomeIcon icon={resolveIcon(name)} {...rest} />;
}

/** Slugs offered in the account / category icon pickers. */
export const ICON_CHOICES: string[] = [
  "bank", "cash", "card", "wallet", "invest", "piggy", "money", "sack", "coins", "building",
  "briefcase", "utensils", "cart", "car", "bag", "bills", "house", "health", "film",
  "education", "gift", "plane", "bus", "train", "coffee", "game", "gym", "fuel", "phone",
  "wifi", "shirt", "baby", "pet", "tag", "box",
];

export function accountTypeIcon(type: string): string {
  const map: Record<string, string> = {
    bank: "bank", cash: "cash", card: "card", wallet: "wallet", investment: "invest", savings: "piggy", other: "box",
  };
  return map[type] ?? "wallet";
}
