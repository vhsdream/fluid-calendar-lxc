import { RRule } from "rrule";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { newDate, normalizeAllDayDate } from "@/lib/date-utils";
import { DEFAULT_TASK_COLOR } from "@/lib/task-utils";

import { useTaskStore } from "@/store/task";

import {
  CalendarEvent,
  CalendarFeed,
  CalendarState,
  CalendarView,
  CalendarViewState,
} from "@/types/calendar";
import { TaskStatus } from "@/types/task";

// Separate store for view preferences that will be persisted in localStorage
interface ViewStore extends CalendarViewState {
  setView: (view: CalendarView) => void;
  setDate: (date: Date) => void;
  setSelectedEventId: (id?: string) => void;
}

export const useViewStore = create<ViewStore>()(
  persist(
    (set) => ({
      view: "week",
      date: newDate(),
      selectedEventId: undefined,
      setView: (view) => set({ view }),
      setDate: (date) => set({ date: newDate(date) }), // Ensure we always store a Date object
      setSelectedEventId: (id) => set({ selectedEventId: id }),
    }),
    {
      name: "calendar-view-store",
      // Only persist the date as ISO string
      partialize: (state) => ({
        view: state.view,
        date: state.date.toISOString(),
        selectedEventId: state.selectedEventId,
      }),
      // Convert ISO string back to Date on hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.date = newDate(state.date);
        }
      },
    }
  )
);

// Store for UI preferences that will be persisted in localStorage
interface UIStore {
  isSidebarOpen: boolean;
  isHydrated: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useCalendarUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      isHydrated: false,
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
    }),
    {
      name: "calendar-ui-store",
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
    }
  )
);

// Main calendar store for data management
interface CalendarStore extends CalendarState {
  // Feed management
  addFeed: (
    name: string,
    url: string,
    type: "GOOGLE" | "OUTLOOK" | "CALDAV",
    color?: string
  ) => Promise<void>;
  removeFeed: (id: string) => Promise<void>;
  toggleFeed: (id: string) => Promise<void>;
  updateFeed: (id: string, updates: Partial<CalendarFeed>) => Promise<void>;

  // Event management
  addEvent: (event: Omit<CalendarEvent, "id">) => Promise<void>;
  updateEvent: (
    id: string,
    updates: Partial<CalendarEvent>,
    mode?: "single" | "series"
  ) => Promise<void>;
  removeEvent: (id: string, mode?: "single" | "series") => Promise<void>;

  // Feed synchronization
  syncFeed: (id: string) => Promise<void>;
  syncAllFeeds: () => Promise<void>;

  // Data loading
  loadFromDatabase: () => Promise<void>;

  // State management
  setFeeds: (feeds: CalendarFeed[]) => void;
  setEvents: (events: CalendarEvent[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | undefined) => void;
  setSelectedDate: (date: Date) => void;
  selectedDate: Date;
  setSelectedView: (view: CalendarView) => void;
  selectedView: CalendarView;
  refreshFeeds: () => Promise<void>;
  refreshEvents: () => Promise<void>;

  // Get expanded events for a date range
  getExpandedEvents: (start: Date, end: Date) => CalendarEvent[];

  // New task-related methods
  getTasksAsEvents: (start: Date, end: Date) => CalendarEvent[];
  getAllCalendarItems: (start: Date, end: Date) => CalendarEvent[];

  syncCalendar: (feedId: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarStore>()((set, get) => ({
  // Initial state
  feeds: [],
  events: [],
  isLoading: false,
  error: undefined,
  selectedDate: newDate(),
  selectedView: "week",

  // Helper function to expand recurring events
  getExpandedEvents: (
    start: Date,
    end: Date,
    expandInstances: boolean = false
  ) => {
    const { events } = get();
    const expandedEvents: CalendarEvent[] = [];
    // console.log("Total events in store:", events.length);

    events.forEach((event) => {
      // Convert event dates to Date objects if they're not already
      let eventStart =
        event.start instanceof Date ? event.start : newDate(event.start);
      let eventEnd = event.end instanceof Date ? event.end : newDate(event.end);

      // For all-day events, normalize the dates to prevent timezone issues
      if (event.allDay) {
        eventStart = normalizeAllDayDate(eventStart);
        eventEnd = normalizeAllDayDate(eventEnd);
      }

      // If it's a non-recurring event or an instance, add it directly
      if (!event.isRecurring || !event.isMaster) {
        // Check if the event overlaps with the date range
        if (eventStart <= end && eventEnd >= start) {
          expandedEvents.push({
            ...event,
            start: eventStart,
            end: eventEnd,
          });
        }
        return;
      }

      // For master events, expand the recurrence
      if (expandInstances && event.isMaster && event.recurrenceRule) {
        try {
          // Parse the recurrence rule
          const rule = RRule.fromString(event.recurrenceRule);

          // Calculate event duration in milliseconds
          const duration = eventEnd.getTime() - eventStart.getTime();

          // Get all occurrences between start and end dates
          const occurrences = rule.between(start, end, true); // true = inclusive

          // Create an event instance for each occurrence
          occurrences.forEach((date) => {
            // Check if there's a modified instance for this date
            const instanceDate = newDate(date);
            const hasModifiedInstance = events.some(
              (e) =>
                !e.isMaster &&
                e.masterEventId === event.id &&
                newDate(e.start).toDateString() === instanceDate.toDateString()
            );

            // Only add the occurrence if there's no modified instance
            if (!hasModifiedInstance) {
              expandedEvents.push({
                ...event,
                id: `${event.id}_${instanceDate.toISOString()}`, // Unique ID for the instance
                start: instanceDate,
                end: newDate(instanceDate.getTime() + duration),
                isMaster: false,
                masterEventId: event.id,
              });
            }
          });
        } catch (error) {
          console.error("Failed to parse recurrence rule:", error);
          console.log("recurrenceRule:", event.recurrenceRule);
          // If we can't parse the rule, just show the original event
          if (eventStart <= end && eventEnd >= start) {
            expandedEvents.push({
              ...event,
              start: eventStart,
              end: eventEnd,
            });
          }
        }
      }
    });

    // console.log("Returning expanded events:", expandedEvents.length);
    return expandedEvents;
  },

  // Feed management
  addFeed: async (name, url, type, color) => {
    const id = uuidv4();
    const feed: CalendarFeed = {
      id,
      name,
      url,
      type,
      color,
      enabled: true,
    };

    try {
      // For Google Calendar feeds, use the Google Calendar API
      if (type === "GOOGLE") {
        const response = await fetch("/api/calendar/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarId: url,
            name,
            color,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add Google Calendar");
        }

        const googleFeed = await response.json();
        set((state) => ({ feeds: [...state.feeds, googleFeed] }));
        return;
      }

      // For iCal feeds, use the existing API
      const response = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feed),
      });

      if (!response.ok) {
        throw new Error("Failed to save feed to database");
      }

      // Update local state after successful database save
      set((state) => ({ feeds: [...state.feeds, feed] }));

      // Sync the feed's events
      if (url) {
        await get().syncFeed(id);
      }
    } catch (error) {
      console.error("Failed to add feed:", error);
      throw error;
    }
  },

  removeFeed: async (id) => {
    try {
      const feed = get().feeds.find((f) => f.id === id);
      if (!feed) return;

      // For Google Calendar feeds, use the Google Calendar API
      if (feed.type === "GOOGLE") {
        const response = await fetch(`/api/calendar/google/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove Google Calendar");
        }
      } else {
        // For other feeds, use the existing API
        const response = await fetch(`/api/feeds/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove feed from database");
        }
      }

      // Update local state after successful database removal
      set((state) => ({
        feeds: state.feeds.filter((feed) => feed.id !== id),
        events: state.events.filter((event) => event.feedId !== id),
      }));
    } catch (error) {
      console.error("Failed to remove feed:", error);
      throw error;
    }
  },

  toggleFeed: async (id) => {
    const feed = get().feeds.find((f) => f.id === id);
    if (!feed) return;

    try {
      // For Google Calendar feeds, use the Google Calendar API
      if (feed.type === "GOOGLE") {
        const response = await fetch(`/api/calendar/google/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !feed.enabled }),
        });

        if (!response.ok) {
          throw new Error("Failed to update Google Calendar");
        }
      } else {
        // For other feeds, use the existing API
        const response = await fetch(`/api/feeds/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !feed.enabled }),
        });

        if (!response.ok) {
          throw new Error("Failed to update feed in database");
        }
      }

      // Update local state after successful database update
      set((state) => ({
        feeds: state.feeds.map((f) =>
          f.id === id ? { ...f, enabled: !f.enabled } : f
        ),
      }));
    } catch (error) {
      console.error("Failed to toggle feed:", error);
      throw error;
    }
  },

  updateFeed: async (id, updates) => {
    try {
      const feed = get().feeds.find((f) => f.id === id);
      if (!feed) return;

      // For Google Calendar feeds, use the Google Calendar API
      if (feed.type === "GOOGLE") {
        const response = await fetch(`/api/calendar/google/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update Google Calendar");
        }
      } else {
        // For other feeds, use the existing API
        const response = await fetch(`/api/feeds/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update feed in database");
        }
      }

      // Update local state after successful database update
      set((state) => ({
        feeds: state.feeds.map((feed) =>
          feed.id === id ? { ...feed, ...updates } : feed
        ),
      }));
    } catch (error) {
      console.error("Failed to update feed:", error);
      throw error;
    }
  },

  // Event management
  addEvent: async (event: Omit<CalendarEvent, "id">) => {
    const newEvent = { ...event, id: uuidv4() };

    try {
      // If no feedId specified, use local calendar
      if (!newEvent.feedId) {
        throw new Error("No feedId specified");
      }

      // Check if we have write permission for this calendar
      const feed = get().feeds.find((f) => f.id === newEvent.feedId);
      if (!feed) {
        throw new Error("Calendar not found");
      }

      // For Google Calendar feeds, use the Google Calendar API
      if (feed.type === "GOOGLE") {
        const response = await fetch("/api/calendar/google/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEvent),
        });

        if (!response.ok) {
          throw new Error("Failed to add event to Google Calendar");
        }

        // Reload from database to get the latest state
        await get().loadFromDatabase();

        // Trigger auto-scheduling after event is created
        const { triggerScheduleAllTasks } = useTaskStore.getState();
        await triggerScheduleAllTasks();
        return;
      }

      // For Outlook Calendar feeds, use the Outlook Calendar API
      if (feed.type === "OUTLOOK") {
        const response = await fetch("/api/calendar/outlook/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEvent),
        });

        if (!response.ok) {
          throw new Error("Failed to add event to Outlook Calendar");
        }

        // Reload from database to get the latest state
        await get().loadFromDatabase();

        // Trigger auto-scheduling after event is created
        const { triggerScheduleAllTasks } = useTaskStore.getState();
        await triggerScheduleAllTasks();
        return;
      }

      // For CalDAV Calendar feeds, use the CalDAV Calendar API
      if (feed.type === "CALDAV") {
        const response = await fetch("/api/calendar/caldav/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEvent),
        });

        if (!response.ok) {
          throw new Error("Failed to add event to CalDAV Calendar");
        }

        // Reload from database to get the latest state
        await get().loadFromDatabase();

        // Trigger auto-scheduling after event is created
        const { triggerScheduleAllTasks } = useTaskStore.getState();
        await triggerScheduleAllTasks();
        return;
      }

      // For other calendars, throw an error
      throw new Error("Unsupported calendar type");
    } catch (error) {
      console.error("Failed to add event:", error);
      throw error;
    }
  },

  updateEvent: async (id, updates, mode) => {
    try {
      const event = get().events.find((e) => e.id === id);
      if (!event) return;

      const feed = get().feeds.find((f) => f.id === event.feedId);
      if (!feed) return;

      // console.log("Updating event:", { id, updates, mode });
      // For Google Calendar feeds, use the Google Calendar API
      if (feed.type === "GOOGLE") {
        const response = await fetch(`/api/calendar/google/events`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id, mode, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update event in Google Calendar");
        }

        // Reload from database to get the latest state
        await get().loadFromDatabase();
        // Trigger auto-scheduling after event is created
        const { triggerScheduleAllTasks } = useTaskStore.getState();
        await triggerScheduleAllTasks();
        return;
      }

      // For Outlook Calendar feeds, use the Outlook Calendar API
      if (feed.type === "OUTLOOK") {
        const response = await fetch(`/api/calendar/outlook/events`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id, mode, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update event in Outlook Calendar");
        }

        // Reload from database to get the latest state
        await get().loadFromDatabase();
        // Trigger auto-scheduling after event is created
        const { triggerScheduleAllTasks } = useTaskStore.getState();
        await triggerScheduleAllTasks();
        return;
      }

      // For CalDAV Calendar feeds, use the CalDAV Calendar API
      if (feed.type === "CALDAV") {
        const response = await fetch(`/api/calendar/caldav/events`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id, mode, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update event in CalDAV Calendar");
        }

        // Reload from database to get the latest state
        await get().loadFromDatabase();
        // Trigger auto-scheduling after event is created
        const { triggerScheduleAllTasks } = useTaskStore.getState();
        await triggerScheduleAllTasks();
        return;
      }

      // For other calendars, throw an error
      throw new Error("Unsupported calendar type");
    } catch (error) {
      console.error("Failed to update event:", error);
      throw error;
    }
  },

  removeEvent: async (id, mode) => {
    try {
      const event = get().events.find((e) => e.id === id);
      if (!event) return;

      const feed = get().feeds.find((f) => f.id === event.feedId);
      if (!feed) return;

      // For Google Calendar feeds, use the Google Calendar API
      if (feed.type === "GOOGLE") {
        const response = await fetch(`/api/calendar/google/events`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id, mode }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete event from Google Calendar");
        }
      } else if (feed.type === "OUTLOOK") {
        // For Outlook Calendar feeds, use the Outlook Calendar API
        const response = await fetch(`/api/calendar/outlook/events`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id, mode }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete event from Outlook Calendar");
        }
      } else if (feed.type === "CALDAV") {
        // For CalDAV Calendar feeds, use the CalDAV Calendar API
        const response = await fetch(`/api/calendar/caldav/events`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id, mode }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete event from CalDAV Calendar");
        }
      } else {
        // For other calendars, use the existing API
        const response = await fetch(`/api/events/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete event from database");
        }
      }

      // Reload from database to get the latest state
      await get().loadFromDatabase();
      // Trigger auto-scheduling after event is created
      const { triggerScheduleAllTasks } = useTaskStore.getState();
      await triggerScheduleAllTasks();
    } catch (error) {
      console.error("Failed to remove event:", error);
      throw error;
    }
  },

  // Feed synchronization
  syncFeed: async (id) => {
    const feed = get().feeds.find((f) => f.id === id);
    if (!feed) return;

    set({ isLoading: true, error: undefined });

    try {
      // For Google Calendar feeds, use the Google Calendar API
      if (feed.type === "GOOGLE") {
        const response = await fetch("/api/calendar/google", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedId: id }),
        });

        if (!response.ok) {
          throw new Error("Failed to sync Google Calendar");
        }
      } else if (feed.type === "OUTLOOK") {
        const response = await fetch("/api/calendar/outlook/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedId: id }),
        });

        if (!response.ok) {
          throw new Error("Failed to sync Outlook Calendar");
        }
      } else if (feed.type === "CALDAV") {
        const response = await fetch("/api/calendar/caldav/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedId: id }),
        });

        if (!response.ok) {
          throw new Error("Failed to sync CalDAV Calendar");
        }
      }

      // Reload events from database
      await get().loadFromDatabase();
      // Trigger auto-scheduling after event is created
      const { triggerScheduleAllTasks } = useTaskStore.getState();
      await triggerScheduleAllTasks();
    } catch (error) {
      console.error("Failed to sync feed:", error);
      // Update feed with error
      await get().updateFeed(id, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  syncAllFeeds: async () => {
    const { feeds } = get();
    for (const feed of feeds) {
      if (feed.enabled) {
        await get().syncFeed(feed.id);
      }
    }
  },

  // Data loading
  loadFromDatabase: async () => {
    try {
      set({ isLoading: true, error: undefined });

      // Load feeds
      // console.log("Fetching feeds...");
      const feedsResponse = await fetch("/api/feeds");
      if (!feedsResponse.ok) {
        throw new Error("Failed to load feeds from database");
      }
      const feeds = await feedsResponse.json();
      // console.log("Loaded feeds:", feeds);

      // Load events
      // console.log("Fetching events...");
      const eventsResponse = await fetch("/api/events");
      if (!eventsResponse.ok) {
        throw new Error("Failed to load events from database");
      }
      const events = await eventsResponse.json();
      // console.log("Loaded events:", events);

      // console.log("Setting state with loaded data:", {
      //   feeds: feeds.length,
      //   events: events.length,
      // });
      set({ feeds, events });
    } catch (error) {
      console.error("Failed to load data from database:", error);
      set({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      set({ isLoading: false });
    }
  },

  setFeeds: (feeds) => set({ feeds }),
  setEvents: (events) => set({ events }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSelectedDate: (date: Date) => set({ selectedDate: date }),
  setSelectedView: (view: CalendarView) => set({ selectedView: view }),

  refreshFeeds: async () => {
    try {
      set({ isLoading: true, error: undefined });
      const response = await fetch("/api/feeds");
      if (!response.ok) throw new Error("Failed to fetch calendar feeds");
      const feeds = await response.json();
      set({ feeds });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshEvents: async () => {
    try {
      set({ isLoading: true, error: undefined });
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Failed to fetch calendar events");
      const events = await response.json();
      set({ events });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      set({ isLoading: false });
    }
  },

  syncCalendar: async (feedId: string) => {
    try {
      set({ isLoading: true, error: undefined });

      // Get the feed to determine its type
      const feed = get().feeds.find((f) => f.id === feedId);
      if (!feed) throw new Error("Calendar not found");

      const endpoint =
        feed.type === "GOOGLE"
          ? `/api/calendar/google/${feedId}`
          : feed.type === "CALDAV"
            ? `/api/calendar/caldav/sync`
            : `/api/calendar/outlook/sync`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync calendar");
      }

      // Refresh events after sync
      await get().refreshEvents();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      set({ isLoading: false });
    }
  },

  // Convert tasks to calendar events
  getTasksAsEvents: (start: Date, end: Date) => {
    const tasks = useTaskStore.getState().tasks;
    // const userTimeZone = useSettingsStore.getState().user.timeZone;

    // Create date boundaries in user's timezone
    const startDay = newDate(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = newDate(end);
    endDay.setHours(23, 59, 59, 999);

    const events = tasks
      .filter((task) => {
        // Skip completed tasks
        if (task.status === TaskStatus.COMPLETED) {
          return false;
        }

        if (task.isAutoScheduled && task.scheduledStart && task.scheduledEnd) {
          // For auto-scheduled tasks, check if scheduled time is within range
          const scheduledStart = newDate(task.scheduledStart);
          return scheduledStart >= startDay && scheduledStart <= endDay;
        } else if (task.dueDate) {
          // For non-auto-scheduled tasks, use due date logic
          const taskDueDate = newDate(task.dueDate);
          const localDate = newDate(taskDueDate);
          localDate.setMinutes(
            localDate.getMinutes() + localDate.getTimezoneOffset()
          );
          localDate.setHours(0, 0, 0, 0);
          return localDate >= startDay && localDate <= endDay;
        }
        return false;
      })
      .map((task) => {
        if (task.isAutoScheduled && task.scheduledStart && task.scheduledEnd) {
          // For auto-scheduled tasks, use the scheduled times
          return {
            id: `${task.id}`,
            feedId: "tasks",
            title: task.title,
            description: task.description || undefined,
            start: newDate(task.scheduledStart),
            end: newDate(task.scheduledEnd),
            isRecurring: task.isRecurring,
            isMaster: false,
            allDay: false,
            color: task.tags[0]?.color || DEFAULT_TASK_COLOR,
            extendedProps: {
              isTask: true,
              taskId: task.id,
              status: task.status,
              priority: task.priority?.toString() || undefined,
              energyLevel: task.energyLevel?.toString() || undefined,
              preferredTime: task.preferredTime?.toString(),
              tags: task.tags,
              isAutoScheduled: true,
              scheduleScore: task.scheduleScore,
              dueDate: task.dueDate
                ? newDate(task.dueDate).toISOString()
                : null,
              startDate: task.startDate
                ? newDate(task.startDate).toISOString()
                : null,
            },
          };
        } else {
          // For non-auto-scheduled tasks, use the existing due date logic
          const taskDueDate = newDate(task.dueDate!);
          const localDate = newDate(taskDueDate);
          localDate.setMinutes(
            localDate.getMinutes() + localDate.getTimezoneOffset()
          );
          const eventDate = newDate(localDate);
          eventDate.setHours(9, 0, 0, 0);

          return {
            id: `${task.id}`,
            feedId: "tasks",
            title: task.title,
            description: task.description || undefined,
            start: eventDate,
            end: task.duration
              ? newDate(eventDate.getTime() + task.duration * 60000)
              : newDate(eventDate.getTime() + 3600000),
            isRecurring: false,
            isMaster: false,
            allDay: true,
            color: task.tags[0]?.color || DEFAULT_TASK_COLOR,
            extendedProps: {
              isTask: true,
              taskId: task.id,
              status: task.status,
              priority: task.priority?.toString() || undefined,
              energyLevel: task.energyLevel?.toString() || undefined,
              preferredTime: task.preferredTime?.toString(),
              tags: task.tags,
              isAutoScheduled: false,
              dueDate: task.dueDate
                ? newDate(task.dueDate).toISOString()
                : null,
              startDate: task.startDate
                ? newDate(task.startDate).toISOString()
                : null,
            },
          };
        }
      });

    return events;
  },

  // Get both events and tasks for the calendar
  getAllCalendarItems: (start: Date, end: Date) => {
    // console.log("Getting all calendar items:", { start, end });
    const events = get().getExpandedEvents(start, end);
    const taskEvents = get().getTasksAsEvents(start, end);
    return [...events, ...taskEvents];
  },
}));
