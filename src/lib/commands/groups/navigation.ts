import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import {
  HiOutlineCalendar,
  HiOutlineClipboardList,
  HiOutlineCog,
  HiOutlineLightningBolt,
} from "react-icons/hi";

import { Command } from "../types";

export function useNavigationCommands(): Command[] {
  return [
    {
      id: "navigation.calendar",
      title: "Go to Calendar",
      keywords: ["navigation"],
      icon: HiOutlineCalendar,
      section: "navigation",
      shortcut: "gc",
      perform: (router?: AppRouterInstance) => {
        if (router) router.push("/calendar");
      },
    },
    {
      id: "navigation.tasks",
      title: "Go to Tasks",
      keywords: ["navigation"],
      icon: HiOutlineClipboardList,
      section: "navigation",
      shortcut: "gt",
      perform: (router?: AppRouterInstance) => {
        if (router) router.push("/tasks");
      },
    },
    {
      id: "navigation.focus",
      title: "Go to Focus",
      keywords: ["navigation"],
      icon: HiOutlineLightningBolt,
      section: "navigation",
      shortcut: "gf",
      perform: (router?: AppRouterInstance) => {
        if (router) router.push("/focus");
      },
    },
    {
      id: "navigation.settings",
      title: "Go to Settings",
      keywords: ["navigation"],
      icon: HiOutlineCog,
      section: "navigation",
      shortcut: "gs",
      perform: (router?: AppRouterInstance) => {
        if (router) router.push("/settings");
      },
    },
  ];
}
