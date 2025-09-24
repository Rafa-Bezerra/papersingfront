// lib/patient-data.ts
export interface NavItem {
  title: string;
  url: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const data = {
  navMain: [
    {
      title: "Módulos",
      items: [
        { title: "Inicio", url: "/home" },
        { title: "Requisições", url: "/requisicoes" },
      ],
    },
  ] as NavSection[],
};
