/**
 * UI copy. English is the source of truth: its shape defines the `Dictionary`
 * type, so a missing or misspelled Spanish key is a compile error.
 */

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

const en = {
  appName: "School Supervision Schedule",
  nav: {
    schedule: "Schedule",
    people: "Staff",
    shifts: "Shifts",
    settings: "Settings",
    print: "Print view",
  },
  weekdays: {
    long: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    short: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  common: {
    add: "Add",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    done: "Done",
    name: "Name",
    from: "From",
    to: "To",
    day: "Day",
    actions: "Actions",
    active: "Active",
    inactive: "Inactive",
    none: "None",
    all: "All",
    back: "Back",
    saving: "Saving…",
    confirmDelete: "Delete this permanently?",
    unsaved: "Unsaved changes",
  },
  schedule: {
    title: "Weekly schedule",
    subtitle: "Generated from each person's availability and the staffing rules.",
    generate: "Generate schedule",
    regenerate: "Regenerate",
    generating: "Solving…",
    empty: "No schedule yet. Generate one to get started.",
    optimal: "Proven optimal",
    notOptimal: "Best found (search cut short)",
    solvedIn: "solved in {ms} ms",
    unstaffed: "Nobody assigned",
    pin: "Lock this person to this shift",
    unpin: "Unlock",
    pinnedLegend: "Locked — kept on the next run",
    clearPins: "Clear all locks",
    needed: "{assigned} of {ideal} needed",
    criticalGap: "Understaffed",
    idealGap: "Below preferred",
    coverageTitle: "Coverage warnings",
    coverageOk: "Every shift meets its minimum.",
    conflicts:
      "{count} assignment(s) no longer fit the person's availability — regenerate to fix.",
    droppedPins:
      "{count} lock(s) were ignored because that person is not available for the shift.",
    workloadTitle: "Weekly hours",
    person: "Person",
    hours: "Hours",
    daysWorked: "Days",
    daysOff: "Day off",
    idle: "Waiting",
    idleHint: "Time spent waiting between shifts",
    spread: "Spread",
    spreadHint: "Difference between the most and least loaded person",
    fairShare: "Even split across everyone",
    totalStaffed: "Total staffed hours",
  },
  people: {
    title: "Staff",
    subtitle: "Who is available, and when.",
    addPerson: "Add person",
    newPerson: "New person",
    availability: "Availability",
    addWindow: "Add time window",
    noWindows: "No availability set — this person will never be scheduled.",
    windowHint: "A shift is only offered to someone if a single window covers it end to end.",
    deletePerson: "Remove person",
    inactiveHint: "Inactive people are kept on record but never scheduled.",
    emptyState: "No staff yet. Add someone to begin.",
  },
  shifts: {
    title: "Shifts",
    subtitle: "The slots that need supervision each week.",
    addShift: "Add shift",
    newShift: "New shift",
    requiredMin: "Minimum",
    requiredIdeal: "Preferred",
    requiredMinHint: "Falling below this is flagged as understaffed.",
    requiredIdealHint: "The headcount to aim for. Shifts are never staffed above it.",
    deleteShift: "Remove shift",
    emptyState: "No shifts yet. Add one to begin.",
    invalidRange: "The end time must be after the start time.",
    invalidCounts: "The preferred headcount cannot be below the minimum.",
  },
  settings: {
    title: "Settings",
    subtitle: "Rules and trade-offs the solver applies.",
    language: "Language",
    rules: "Hard rules",
    maxGap: "Maximum wait between shifts",
    maxGapHint:
      "Nobody is scheduled with a longer unpaid gap between two of their own shifts.",
    maxOverlap: "Tolerated shift overlap",
    maxOverlapHint:
      "Two shifts overlapping by up to this much count as the same post, so one person can work both back to back.",
    minutes: "minutes",
    weights: "Priorities",
    weightsHint:
      "Higher means the solver tries harder. The two understaffing weights are deliberately far larger than the rest so coverage always wins.",
    understaffCritical: "Avoid understaffing",
    understaffIdeal: "Reach preferred headcount",
    fairness: "Even out hours",
    idleTime: "Avoid waiting between shifts",
    dayOff: "Give everyone a day off",
    reset: "Restore defaults",
    saved: "Settings saved.",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
    system: "Match system",
  },
  undo: {
    label: "Undo",
    empty: "Nothing to undo",
    shortcut: "\u2318Z / Ctrl+Z",
    tooltip: "Undo: {action}",
    actions: {
      unknown: "last change",
      generate: "generating the schedule",
      pin: "locking {person} to {shift}",
      unpin: "unlocking {person} from {shift}",
      clearPins: "clearing all locks",
      addPerson: "adding {person}",
      editPerson: "editing {person}",
      deletePerson: "removing {person}",
      addWindow: "adding availability for {person}",
      editWindow: "editing availability for {person}",
      deleteWindow: "removing availability for {person}",
      addShift: "adding {shift}",
      editShift: "editing {shift}",
      deleteShift: "removing {shift}",
      editSettings: "changing settings",
    },
  },
  print: {
    title: "Weekly schedule",
    printedOn: "Printed {date}",
    print: "Print",
    byPerson: "By person",
    byShift: "By shift",
  },
} as const;

/**
 * Structural type derived from English so Spanish cannot drift out of sync:
 * a missing, extra or misspelled key is a compile error. Recurses to any depth
 * and widens the `as const` literals back to plain strings.
 */
type Translated<T> = {
  -readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends readonly string[]
      ? readonly string[]
      : Translated<T[K]>;
};

export type Dictionary = Translated<typeof en>;

const es: Dictionary = {
  appName: "Horario de Supervisión Escolar",
  nav: {
    schedule: "Horario",
    people: "Personal",
    shifts: "Turnos",
    settings: "Ajustes",
    print: "Vista de impresión",
  },
  weekdays: {
    long: ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    short: ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  },
  common: {
    add: "Agregar",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    done: "Listo",
    name: "Nombre",
    from: "Desde",
    to: "Hasta",
    day: "Día",
    actions: "Acciones",
    active: "Activo",
    inactive: "Inactivo",
    none: "Ninguno",
    all: "Todos",
    back: "Volver",
    saving: "Guardando…",
    confirmDelete: "¿Eliminar esto definitivamente?",
    unsaved: "Cambios sin guardar",
  },
  schedule: {
    title: "Horario semanal",
    subtitle: "Generado a partir de la disponibilidad de cada persona y las reglas de cobertura.",
    generate: "Generar horario",
    regenerate: "Regenerar",
    generating: "Resolviendo…",
    empty: "Todavía no hay horario. Generá uno para empezar.",
    optimal: "Óptimo comprobado",
    notOptimal: "Mejor encontrado (búsqueda interrumpida)",
    solvedIn: "resuelto en {ms} ms",
    unstaffed: "Sin asignar",
    pin: "Fijar a esta persona en este turno",
    unpin: "Desfijar",
    pinnedLegend: "Fijado — se mantiene en la próxima generación",
    clearPins: "Quitar todos los fijados",
    needed: "{assigned} de {ideal} necesarias",
    criticalGap: "Falta personal",
    idealGap: "Por debajo de lo ideal",
    coverageTitle: "Alertas de cobertura",
    coverageOk: "Todos los turnos cumplen su mínimo.",
    conflicts:
      "{count} asignación(es) ya no entran en la disponibilidad de esa persona — regenerá para corregirlo.",
    droppedPins:
      "Se ignoraron {count} fijado(s) porque esa persona no está disponible para el turno.",
    workloadTitle: "Horas semanales",
    person: "Persona",
    hours: "Horas",
    daysWorked: "Días",
    daysOff: "Día libre",
    idle: "Espera",
    idleHint: "Tiempo muerto entre turnos",
    spread: "Diferencia",
    spreadHint: "Diferencia entre quien más y quien menos trabaja",
    fairShare: "Reparto parejo entre todas",
    totalStaffed: "Horas cubiertas en total",
  },
  people: {
    title: "Personal",
    subtitle: "Quién está disponible, y cuándo.",
    addPerson: "Agregar persona",
    newPerson: "Nueva persona",
    availability: "Disponibilidad",
    addWindow: "Agregar franja horaria",
    noWindows: "Sin disponibilidad cargada — nunca se le asignarán turnos.",
    windowHint:
      "Un turno solo se le ofrece a alguien si una sola franja lo cubre de principio a fin.",
    deletePerson: "Quitar persona",
    inactiveHint: "Las personas inactivas quedan registradas pero no se les asignan turnos.",
    emptyState: "Todavía no hay personal. Agregá a alguien para empezar.",
  },
  shifts: {
    title: "Turnos",
    subtitle: "Las franjas que necesitan supervisión cada semana.",
    addShift: "Agregar turno",
    newShift: "Nuevo turno",
    requiredMin: "Mínimo",
    requiredIdeal: "Ideal",
    requiredMinHint: "Por debajo de esto se marca como falta de personal.",
    requiredIdealHint: "La cantidad a la que se apunta. Nunca se asigna más que esto.",
    deleteShift: "Quitar turno",
    emptyState: "Todavía no hay turnos. Agregá uno para empezar.",
    invalidRange: "La hora de fin debe ser posterior a la de inicio.",
    invalidCounts: "El ideal no puede ser menor que el mínimo.",
  },
  settings: {
    title: "Ajustes",
    subtitle: "Reglas y prioridades que aplica el generador.",
    language: "Idioma",
    rules: "Reglas estrictas",
    maxGap: "Espera máxima entre turnos",
    maxGapHint:
      "A nadie se le asigna un hueco sin trabajar más largo que esto entre dos de sus turnos.",
    maxOverlap: "Solapamiento tolerado",
    maxOverlapHint:
      "Dos turnos que se pisan hasta este tiempo cuentan como el mismo puesto, así que una persona puede hacer los dos seguidos.",
    minutes: "minutos",
    weights: "Prioridades",
    weightsHint:
      "Más alto significa que el generador se esfuerza más. Los dos pesos de falta de personal son muchísimo más grandes que el resto para que la cobertura siempre gane.",
    understaffCritical: "Evitar falta de personal",
    understaffIdeal: "Llegar a la cantidad ideal",
    fairness: "Emparejar las horas",
    idleTime: "Evitar esperas entre turnos",
    dayOff: "Dar un día libre a cada una",
    reset: "Restaurar valores por defecto",
    saved: "Ajustes guardados.",
  },
  theme: {
    label: "Tema",
    light: "Claro",
    dark: "Oscuro",
    system: "Seguir al sistema",
  },
  undo: {
    label: "Deshacer",
    empty: "Nada para deshacer",
    shortcut: "\u2318Z / Ctrl+Z",
    tooltip: "Deshacer: {action}",
    actions: {
      unknown: "el \u00faltimo cambio",
      generate: "generar el horario",
      pin: "fijar a {person} en {shift}",
      unpin: "desfijar a {person} de {shift}",
      clearPins: "quitar todos los fijados",
      addPerson: "agregar a {person}",
      editPerson: "editar a {person}",
      deletePerson: "quitar a {person}",
      addWindow: "agregar disponibilidad de {person}",
      editWindow: "editar disponibilidad de {person}",
      deleteWindow: "quitar disponibilidad de {person}",
      addShift: "agregar {shift}",
      editShift: "editar {shift}",
      deleteShift: "quitar {shift}",
      editSettings: "cambiar los ajustes",
    },
  },
  print: {
    title: "Horario semanal",
    printedOn: "Impreso el {date}",
    print: "Imprimir",
    byPerson: "Por persona",
    byShift: "Por turno",
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

/** Replace {placeholders} in a template string. */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
