import { describe, expect, it } from "vitest";
import {
  BIRTHDAY_WINDOW,
  birthdayText,
  clientsHref,
  type ClientStat,
  clientsForTab,
  daysToBirthday,
  matchesClient,
  parseClientTab,
  tabDetail,
  upcomingBirthday,
} from "@/features/clients/lib/tabs";

// T-10.1.1 (US-047): las pestañas de Clientes, la búsqueda y los próximos cumpleaños.
const TODAY = "2026-11-05";

function client(fullName: string, extra: Partial<ClientStat> = {}): ClientStat {
  return {
    id: fullName,
    fullName,
    phone: null,
    birthDate: null,
    visits: 0,
    daysAway: null,
    invoiced: 0,
    hasAccount: false,
    isBlocked: false,
    ...extra,
  };
}

const MATEO = client("Mateo Gómez", {
  phone: "+573005550121",
  visits: 12,
  daysAway: 15,
  birthDate: "1990-11-20",
});
const ANDREA = client("Ándrea Ruiz", {
  visits: 3,
  daysAway: 45,
  birthDate: "1995-01-02",
});
const BRUNO = client("Bruno Díaz", { visits: 12, daysAway: 3 });
const CAMILA = client("Camila Torres", {
  phone: "+573005550301",
  birthDate: "2000-06-14",
});
const DARIO = client("Darío Vélez", { birthDate: "1988-11-05" });
const ALL = [MATEO, ANDREA, BRUNO, CAMILA, DARIO];

const names = (list: ClientStat[]) => list.map((item) => item.fullName);
const tab = (
  name: Parameters<typeof clientsForTab>[1]["tab"],
  extra: { query?: string; birthdays?: boolean } = {},
) =>
  names(
    clientsForTab(
      ALL,
      {
        tab: name,
        query: extra.query ?? "",
        birthdays: extra.birthdays ?? false,
      },
      TODAY,
    ),
  );

describe("parseClientTab", () => {
  it("toma las cuatro pestañas y lo demás es Todos", () => {
    expect(parseClientTab("mejores")).toBe("mejores");
    expect(parseClientTab("no-vuelven")).toBe("no-vuelven");
    expect(parseClientTab("sin-visitas")).toBe("sin-visitas");
    expect(parseClientTab("todos")).toBe("todos");
    expect(parseClientTab("cumple")).toBe("todos");
    expect(parseClientTab(undefined)).toBe("todos");
    expect(parseClientTab(["mejores"])).toBe("todos");
  });
});

describe("las pestañas", () => {
  it("Todos va de la A a la Z, sin importar las tildes", () => {
    expect(tab("todos")).toEqual([
      "Ándrea Ruiz",
      "Bruno Díaz",
      "Camila Torres",
      "Darío Vélez",
      "Mateo Gómez",
    ]);
  });

  it("Mejores clientes: los de más visitas, sin los que no tienen; si empatan, por nombre", () => {
    expect(tab("mejores")).toEqual([
      "Bruno Díaz",
      "Mateo Gómez",
      "Ándrea Ruiz",
    ]);
  });

  it("No han vuelto: más días primero, sin los que nunca vinieron", () => {
    expect(tab("no-vuelven")).toEqual([
      "Ándrea Ruiz",
      "Mateo Gómez",
      "Bruno Díaz",
    ]);
  });

  it("No han vuelto: si llevan los mismos días, por nombre", () => {
    const list = clientsForTab(
      [
        client("Zoe", { visits: 1, daysAway: 9 }),
        client("Ana", { visits: 1, daysAway: 9 }),
      ],
      { tab: "no-vuelven", query: "", birthdays: false },
      TODAY,
    );
    expect(names(list)).toEqual(["Ana", "Zoe"]);
  });

  it("Aún no te visitan: las fichas sin visitas, de la A a la Z", () => {
    expect(tab("sin-visitas")).toEqual(["Camila Torres", "Darío Vélez"]);
  });

  it("Próximos cumpleaños: los de los próximos 30 días, el más cercano primero y pasando el año", () => {
    expect(tab("todos", { birthdays: true })).toEqual([
      "Darío Vélez",
      "Mateo Gómez",
    ]);
    // Desde el 20 de diciembre, el 2 de enero ya entra (13 días) y noviembre no.
    expect(
      names(
        clientsForTab(
          ALL,
          { tab: "todos", query: "", birthdays: true },
          "2026-12-20",
        ),
      ),
    ).toEqual(["Ándrea Ruiz"]);
  });

  it("Próximos cumpleaños: si cumplen el mismo día, por nombre", () => {
    const list = clientsForTab(
      [
        client("Zoe", { birthDate: "1990-11-10" }),
        client("Ana", { birthDate: "1999-11-10" }),
      ],
      { tab: "todos", query: "", birthdays: true },
      TODAY,
    );
    expect(names(list)).toEqual(["Ana", "Zoe"]);
  });

  it("la búsqueda se cruza con la pestaña", () => {
    expect(tab("mejores", { query: "mateo" })).toEqual(["Mateo Gómez"]);
    expect(tab("sin-visitas", { query: "mateo" })).toEqual([]);
    expect(tab("todos", { query: "dario", birthdays: true })).toEqual([
      "Darío Vélez",
    ]);
  });
});

describe("matchesClient", () => {
  it("busca por el nombre sin tildes ni mayúsculas", () => {
    expect(matchesClient(MATEO, "GOMEZ")).toBe(true);
    expect(matchesClient(ANDREA, "andrea")).toBe(true);
    expect(matchesClient(ANDREA, "  ")).toBe(true);
    expect(matchesClient(ANDREA, "mateo")).toBe(false);
  });

  it("con 3 dígitos o más busca también en el celular, con o sin espacios", () => {
    expect(matchesClient(MATEO, "300 555 0121")).toBe(true);
    expect(matchesClient(MATEO, "0121")).toBe(true);
    expect(matchesClient(MATEO, "12")).toBe(false);
    expect(matchesClient(CAMILA, "0121")).toBe(false);
    // Sin celular no hay con qué comparar.
    expect(matchesClient(DARIO, "300")).toBe(false);
  });
});

describe("daysToBirthday", () => {
  it("cuenta los días que faltan, y hoy es 0", () => {
    expect(daysToBirthday("1990-11-20", TODAY)).toBe(15);
    expect(daysToBirthday("1988-11-05", TODAY)).toBe(0);
  });

  it("si ya pasó este año, cuenta hasta el del año que viene", () => {
    expect(daysToBirthday("1990-11-04", TODAY)).toBe(364);
    expect(daysToBirthday("1995-01-02", "2026-12-20")).toBe(13);
  });

  it("el 29 de febrero cae el 28 en los años que no son bisiestos", () => {
    expect(daysToBirthday("2000-02-29", "2027-02-20")).toBe(8);
    expect(daysToBirthday("2000-02-29", "2028-02-20")).toBe(9);
    expect(daysToBirthday("2000-02-29", "2027-03-01")).toBe(365);
    expect(daysToBirthday("2000-02-29", "2100-02-27")).toBe(1);
    expect(daysToBirthday("2000-02-29", "2400-02-27")).toBe(2);
  });
});

describe("upcomingBirthday", () => {
  it("da los días solo si cae en la ventana de 30", () => {
    expect(upcomingBirthday(MATEO, TODAY)).toBe(15);
    expect(
      upcomingBirthday(client("X", { birthDate: "1990-12-05" }), TODAY),
    ).toBe(BIRTHDAY_WINDOW);
    expect(
      upcomingBirthday(client("X", { birthDate: "1990-12-06" }), TODAY),
    ).toBeNull();
    expect(upcomingBirthday(BRUNO, TODAY)).toBeNull();
  });
});

describe("clientsHref", () => {
  it("Todos sin nada es la dirección sola", () => {
    expect(clientsHref({ tab: "todos", query: "  ", birthdays: false })).toBe(
      "/pro/clientes",
    );
  });

  it("lleva la pestaña, el filtro de cumpleaños solo en Todos y la búsqueda", () => {
    expect(clientsHref({ tab: "todos", query: "", birthdays: true })).toBe(
      "/pro/clientes?cumple=1",
    );
    expect(
      clientsHref({ tab: "mejores", query: " Gómez ", birthdays: true }),
    ).toBe("/pro/clientes?pestana=mejores&q=G%C3%B3mez");
  });
});

describe("tabDetail", () => {
  const ALL_TABS = { birthdays: false } as const;

  it("da el dato de cada pestaña, en singular o plural", () => {
    expect(tabDetail(MATEO, { ...ALL_TABS, tab: "mejores" }, TODAY)).toBe(
      "12 visitas",
    );
    expect(
      tabDetail(
        client("X", { visits: 1 }),
        { ...ALL_TABS, tab: "mejores" },
        TODAY,
      ),
    ).toBe("1 visita");
    expect(tabDetail(ANDREA, { ...ALL_TABS, tab: "no-vuelven" }, TODAY)).toBe(
      "45 días",
    );
    expect(
      tabDetail(
        client("X", { daysAway: 1 }),
        { ...ALL_TABS, tab: "no-vuelven" },
        TODAY,
      ),
    ).toBe("1 día");
    expect(
      tabDetail(CAMILA, { ...ALL_TABS, tab: "no-vuelven" }, TODAY),
    ).toBeNull();
    expect(tabDetail(CAMILA, { ...ALL_TABS, tab: "sin-visitas" }, TODAY)).toBe(
      "Sin visitas",
    );
  });

  it("en Todos solo dice algo con el filtro de cumpleaños", () => {
    expect(
      tabDetail(MATEO, { tab: "todos", birthdays: false }, TODAY),
    ).toBeNull();
    expect(
      tabDetail(BRUNO, { tab: "todos", birthdays: true }, TODAY),
    ).toBeNull();
    expect(tabDetail(MATEO, { tab: "todos", birthdays: true }, TODAY)).toBe(
      "Cumple el 20 nov",
    );
    expect(tabDetail(DARIO, { tab: "todos", birthdays: true }, TODAY)).toBe(
      "Cumple hoy",
    );
  });
});

describe("birthdayText", () => {
  it("escribe el día y el mes corto, sin el año", () => {
    expect(birthdayText("1990-03-14")).toBe("14 mar");
    expect(birthdayText("1985-09-01")).toBe("1 sept");
  });
});
