// Macedonian is the source of copy. en.ts must have exactly the same keys (its type is `Dict`).
// Add new keys to the section of the feature that owns them and mirror them in en.ts.
// Placeholders look like {n}; they are filled by t(key, { n: 3 }).
export const mk = {
  // ── app and shared
  "app.name": "Мое Скопје",
  "app.tagline": "Живи податоци за градот, на едно место.",
  "common.close": "Затвори",
  "common.back": "Назад",
  "common.continue": "Продолжи",
  "common.done": "Готово",
  "common.cancel": "Откажи",
  "common.retry": "Обиди се повторно",
  "common.source": "Извор",
  "common.error": "Нешто тргна наопаку. Обидете се повторно.",
  "search.placeholder": "Пребарај во Скопје",

  // ── tabs
  "tab.explore": "Истражи",
  "tab.report": "Пријави",
  "tab.ask": "Прашај",
  "tab.settings": "Поставки",

  // ── layers (titleKey in lib/layers.ts)
  "layer.air": "Воздух",
  "layer.weather": "Време",
  "layer.outages-power": "Прекини на струја",
  "layer.outages-water": "Прекини на вода",
  "layer.outages-heating": "Прекини на греење",
  "layer.buses": "Автобуси",
  "layer.parking": "Паркинг",
  "layer.pharmacies": "Дежурни аптеки",
  "layer.earthquakes": "Земјотреси",
  "layer.events": "Настани",
  "layer.waste": "Собирање смет",
  "layer.schools": "Училишта и градинки",

  // ── status badges (spec §6.8): "<status> · <age>", e.g. "Во живо · 3 мин"
  "status.live": "Во живо",
  "status.stale": "Застарено",
  "status.offline": "Демо податоци",
  "status.static": "Статично",
  "age.min": "{n} мин",
  "age.h": "{n} ч",
  "age.d": "{n} д",

  // ── map
  "map.tilesUnavailable": "Картата моментално не е достапна",
  "map.myLocation": "Моја локација",
  "map.layers": "Слоеви",

  // ── explore
  "explore.today": "Денес во Скопје",
  "explore.airNow": "Воздух сега",
  "explore.weather": "Време",
  "explore.outages": "Активни прекини",
  "explore.nextBus": "Следен автобус во близина",
  "explore.layers": "Слоеви",
  "explore.noData": "Нема податоци",

  // ── air detail
  "air.level.0": "Добар",
  "air.level.1": "Умерен",
  "air.level.2": "Нездрав за чувствителни",
  "air.level.3": "Нездрав",
  "air.advice.0": "Воздухот е чист. Одлично време за престој надвор.",
  "air.advice.1": "Воздухот е прифатлив. Многу чувствителните лица нека не се задржуваат долго надвор.",
  "air.advice.2": "Децата, постарите лица и астматичарите нека го скратат времето надвор.",
  "air.advice.3": "Воздухот е нездрав. Избегнувајте напорни активности надвор и држете ги прозорците затворени.",

  // ── onboarding
  "onboarding.welcome": "Добредојдовте во Мое Скопје",
  "onboarding.welcomeBody": "Воздух, прекини, автобуси, паркинг и аптеки, сè на една карта.",
  "onboarding.language": "Јазик",
  "onboarding.layersTitle": "Што сакате да следите?",
  "onboarding.layersBody": "Подоцна можете да го промените ова во Поставки.",
  "onboarding.locationTitle": "Најдете што има во ваша близина",
  "onboarding.locationBody": "Локацијата се користи само за приказ на автобуси и аптеки во близина.",
  "onboarding.allowLocation": "Дозволи локација",
  "onboarding.skip": "Прескокни",
  "onboarding.start": "Започни",

  // ── settings and data health
  "settings.title": "Поставки",
  "settings.language": "Јазик",
  "settings.theme": "Тема",
  "settings.theme.system": "Системска",
  "settings.theme.light": "Светла",
  "settings.theme.dark": "Темна",
  "settings.layers": "Стандардни слоеви",
  "settings.health": "Состојба на податоците",
  "settings.healthBody": "Секој извор, неговата состојба и кога последно е ажуриран.",
  "settings.openSource": "Отвори го изворот",
  "settings.about": "За апликацијата",
  "settings.aboutBody":
    "Мое Скопје ги собира јавните податоци на градот на едно место. Податоците доаѓаат од јавни извори и може да каснат или да недостасуваат; секогаш е означено колку се свежи.",

  // kept until the UI agent drops the report tab: AppShell.tsx still reads report.title, TabBar/AppShell the tab.report label
  "report.title": "Пријавете проблем",

  // ── assistant
  "assistant.title": "Асистент за градот",
  "assistant.placeholder": "Прашајте нешто за Скопје…",
  "assistant.send": "Испрати",
  "assistant.suggest.1": "Каков е воздухот во Аеродром?",
  "assistant.suggest.2": "Има ли струја утре во Карпош?",
  "assistant.suggest.3": "Која аптека е дежурна во моја близина?",
  "assistant.refused": "Не можам да одговорам на ова. Обидете се со друго прашање.",
  "assistant.unavailable": "Асистентот не е достапен",
  "assistant.rateLimited": "Ја достигнавте границата на пораки за овој час. Обидете се подоцна.",

  // --- Task 7: air ---
  "air.cityPm10": "PM10 во градот",
  "air.stations": "Мерни станици ({n})",
  "air.official": "Официјална",
  "air.trend": "PM10, последни 7 дена (дневен просек)",

  // --- Task 9: buses ---
  "buses.next": "Следни поаѓања",
  "buses.line": "Линија {line}",
  "buses.none": "Нема повеќе поаѓања денес.",
  "buses.noTimetable": "Нема распоред за линиите на оваа постојка.",
  "buses.approximate": "Приближен распоред, не е официјален.",

  // --- Task 12: assistant ---
  "assistant.intro": "Прашајте ме за воздухот, прекините, автобусите или аптеките. Одговарам според живите податоци за градот.",
  "assistant.typing": "Асистентот пишува…",
  "assistant.error": "Асистентот не успеа да одговори. Обидете се повторно.",

  // --- Task 4: shell ---
  "lang.mk": "Македонски",
  "lang.en": "English",
  "lang.mk.short": "МК",
  "lang.en.short": "EN",
  "shell.tabs": "Главно мени",
  "shell.comingSoon": "Ова го подготвуваме. Наскоро ќе биде тука.",
  "shell.searchResults": "Резултати од пребарувањето",
  "shell.noResults": "Нема резултати",
  "map.region": "Карта на Скопје",
  "map.locationUnavailable": "Не можевме да ја најдеме вашата локација",
  "explore.allClear": "Моментално нема прекини",
  "explore.nearCentre": "Најблиску до центарот",
  "explore.distance": "{d} од вас",
  "marker.when": "Кога",
  "onboarding.step": "Чекор {n} од {total}",
  "onboarding.locationDenied": "Локацијата не е дозволена. Можете да ја вклучите подоцна со копчето на картата.",
  "settings.healthEmpty": "Сè уште нема поврзани извори.",
  "settings.items": "Записи: {n}",

  // --- fix wave B ---
  "air.pm25": "PM2.5",
  "air.details": "Детали за квалитетот на воздухот",
  "detail.pm10": "PM10",
  "detail.no2": "NO₂",
  "detail.o3": "O₃",
  "detail.noise": "Бучава",
  "detail.temperature": "Температура",
  "detail.apparent": "Се чувствува како",
  "detail.precipitation": "Врнежи",
  "detail.wind": "Ветер",
  "detail.depth": "Длабочина",
  "detail.type": "Вид",
  "detail.streets": "Улици",
  "detail.lines": "Линии",
  "detail.municipality": "Општина",
  "detail.address": "Адреса",
  "detail.hours": "Работно време",
  "detail.phone": "Телефон",
  "detail.website": "Веб-страница",
  "detail.operator": "Оператор",
  "detail.zone": "Зона",
  "detail.price": "Цена",
  "detail.capacity": "Паркинг места",
  "detail.fee": "Со наплата",
  "detail.yes": "Да",
  "detail.no": "Не",
  "marker.onDuty": "Дежурна",
  "marker.approx": "Приближна локација: центарот на општината",
  "assistant.barPlaceholder": "Прашај за градот…",
  "assistant.collapse": "Скриј го разговорот",
  "assistant.expand": "Прикажи го разговорот",

  // --- Task 13: tier 2 ---
  "goOut.title": "Како е за надвор?",
  "goOut.score": "Оцена {score} од 100",
  "goOut.verdict.good": "Одличен ден за надвор",
  "goOut.verdict.fair": "Во ред, но внимавајте",
  "goOut.verdict.poor": "Подобро останете внатре",
  "goOut.reason.air": "Загаден воздух",
  "goOut.reason.rain": "Врне",
  "goOut.reason.temp": "Екстремна температура",
  "eservices.title": "е-Услуги",
  "eservices.hint": "Најчестите работи што можете да ги средите онлајн.",
  "eservices.opensNew": "се отвора во нов прозорец",
};
