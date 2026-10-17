import type { Dict } from "./core";

// Same keys as mk.ts (the compiler enforces it through `Dict`), in the same order.
export const en: Dict = {
  // ── app and shared
  "app.name": "Moe Skopje",
  "app.tagline": "Skopje's live city data, in one place.",
  "common.close": "Close",
  "common.back": "Back",
  "common.continue": "Continue",
  "common.done": "Done",
  "common.cancel": "Cancel",
  "common.retry": "Try again",
  "common.source": "Source",
  "common.error": "Something went wrong. Please try again.",
  "search.placeholder": "Search Skopje",

  // ── tabs
  "tab.explore": "Explore",
  "tab.report": "Report",
  "tab.ask": "Ask",
  "tab.settings": "Settings",

  // ── layers (titleKey in lib/layers.ts)
  "layer.air": "Air quality",
  "layer.weather": "Weather",
  "layer.outages-power": "Power outages",
  "layer.outages-water": "Water outages",
  "layer.outages-heating": "Heating outages",
  "layer.buses": "Buses",
  "layer.parking": "Parking",
  "layer.pharmacies": "On-duty pharmacies",
  "layer.earthquakes": "Earthquakes",
  "layer.events": "Events",
  "layer.waste": "Waste collection",
  "layer.schools": "Schools & kindergartens",

  // ── status badges (spec §6.8): "<status> · <age>", e.g. "Live · 3 min"
  "status.live": "Live",
  "status.stale": "Stale",
  "status.offline": "Demo data",
  "status.static": "Static",
  "age.min": "{n} min",
  "age.h": "{n} h",
  "age.d": "{n} d",

  // ── map
  "map.tilesUnavailable": "Map tiles unavailable",
  "map.myLocation": "My location",
  "map.layers": "Layers",

  // ── explore
  "explore.today": "Today in Skopje",
  "explore.airNow": "Air now",
  "explore.weather": "Weather",
  "explore.outages": "Active outages",
  "explore.nextBus": "Next bus near you",
  "explore.layers": "Layers",
  "explore.noData": "No data",

  // ── air detail
  "air.level.0": "Good",
  "air.level.1": "Moderate",
  "air.level.2": "Unhealthy for sensitive groups",
  "air.level.3": "Unhealthy",
  "air.advice.0": "The air is clean. A great time to be outside.",
  "air.advice.1": "Air quality is acceptable. Very sensitive people should limit long stays outdoors.",
  "air.advice.2": "Children, older adults and people with asthma should cut down on time outside.",
  "air.advice.3": "The air is unhealthy. Avoid strenuous outdoor activity and keep windows closed.",

  // ── onboarding
  "onboarding.welcome": "Welcome to Moe Skopje",
  "onboarding.welcomeBody": "Air, power, buses and parking, all on one map.",
  "onboarding.language": "Language",
  "onboarding.layersTitle": "What do you want to follow?",
  "onboarding.layersBody": "You can change this later in Settings.",
  "onboarding.locationTitle": "Find what's near you",
  "onboarding.locationBody": "Your location is only used to show nearby buses and pharmacies.",
  "onboarding.allowLocation": "Allow location",
  "onboarding.skip": "Skip",
  "onboarding.start": "Get started",

  // ── settings and data health
  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "settings.theme.system": "System",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.layers": "Default layers",
  "settings.health": "Data health",
  "settings.healthBody": "Every source, its status and when it was last updated.",
  "settings.openSource": "Open the source",
  "settings.about": "About",
  "settings.aboutBody":
    "Moe Skopje brings the city's public data together in one place. It comes from public sources and can be late or missing; how fresh it is is always shown.",

  // kept until the UI agent drops the report tab: AppShell.tsx still reads report.title, TabBar/AppShell the tab.report label
  "report.title": "Report an issue",

  // ── assistant
  "assistant.title": "City assistant",
  "assistant.placeholder": "Ask anything about Skopje…",
  "assistant.send": "Send",
  "assistant.suggest.1": "How is the air in Aerodrom?",
  "assistant.suggest.2": "Will there be power in Karpoš tomorrow?",
  "assistant.suggest.3": "Which pharmacy is on duty near me?",
  "assistant.refused": "I can't help with that. Try a different question.",
  "assistant.unavailable": "Assistant unavailable",
  "assistant.rateLimited": "You've reached the message limit for this hour. Please try again later.",

  // --- Task 7: air ---
  "air.cityPm10": "City PM10",
  "air.stations": "Stations ({n})",
  "air.official": "Official",
  "air.trend": "PM10, last 7 days (daily average)",

  // --- Task 9: buses ---
  "buses.next": "Next departures",
  "buses.line": "Line {line}",
  "buses.none": "No more departures today.",
  "buses.noTimetable": "No timetable for the lines at this stop.",
  "buses.approximate": "Approximate timetable, not official.",

  // --- Task 12: assistant ---
  "assistant.intro": "Ask me about the air, outages, buses or pharmacies. I answer from the city's live data.",
  "assistant.typing": "The assistant is typing…",
  "assistant.error": "The assistant couldn't answer. Please try again.",

  // --- Task 4: shell ---
  "lang.mk": "Македонски",
  "lang.en": "English",
  "lang.mk.short": "МК",
  "lang.en.short": "EN",
  "shell.tabs": "Main menu",
  "shell.comingSoon": "We're building this. It'll be here soon.",
  "shell.searchResults": "Search results",
  "shell.noResults": "No results",
  "map.region": "Map of Skopje",
  "map.locationUnavailable": "We couldn't find your location",
  "explore.allClear": "No outages right now",
  "explore.nearCentre": "Nearest to the centre",
  "explore.distance": "{d} away",
  "marker.when": "When",
  "onboarding.step": "Step {n} of {total}",
  "onboarding.locationDenied": "Location wasn't allowed. You can turn it on later with the button on the map.",
  "settings.healthEmpty": "No sources connected yet.",
  "settings.items": "Items: {n}",
};
