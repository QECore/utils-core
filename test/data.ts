/**
 * Standard CRM Test Dataset
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Developer" | "Designer" | "QA";
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  lead: string;
  members: string[];
}

export interface Project {
  id: string;
  name: string;
  status: "active" | "completed";
  teamId: string;
  manager: {
    name: string;
    email: string;
  };
}

export interface CRM {
  users: User[];
  teams: Team[];
  projects: Project[];
}

export const crm: CRM = {
  users: [
    {
      id: "U001",
      name: "Shan",
      email: "shan@company.com",
      role: "Developer",
      teamId: "T001",
    },
    {
      id: "U002",
      name: "John",
      email: "john@company.com",
      role: "Designer",
      teamId: "T002",
    },
    {
      id: "U003",
      name: "Teja",
      email: "teja@company.com",
      role: "QA",
      teamId: "T001",
    },
    {
      id: "U004",
      name: "Anem",
      email: "anem@company.com",
      role: "QA",
      teamId: "T003",
    },
  ],

  teams: [
    {
      id: "T001",
      name: "Engineering",
      lead: "Shan",
      members: ["U001"],
    },
    {
      id: "T002",
      name: "Design",
      lead: "John",
      members: ["U002"],
    },
  ],

  projects: [
    {
      id: "P001",
      name: "CRM",
      status: "active",
      teamId: "T001",
      manager: {
        name: "Shan",
        email: "shan@company.com",
      },
    },
    {
      id: "P002",
      name: "Website",
      status: "completed",
      teamId: "T002",
      manager: {
        name: "John",
        email: "john@company.com",
      },
    },
  ],
};

export const sampleBrowserOptions = {
  browser: ["chromium", "firefox"] as const,
  environment: ["local", "ci"] as const,
};

export const sampleOsThemeOptions = {
  os: ["mac", "windows"] as const,
  theme: ["dark", "light"] as const,
};
