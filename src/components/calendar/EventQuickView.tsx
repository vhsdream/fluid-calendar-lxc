import * as Popover from "@radix-ui/react-popover";
import { CalendarEvent, AttendeeStatus } from "@/types/calendar";
import { Task, TaskStatus, Priority } from "@/types/task";
import { format, newDate } from "@/lib/date-utils";
import { isTaskOverdue } from "@/lib/task-utils";
import {
  IoTimeOutline,
  IoLocationOutline,
  IoRepeat,
  IoPeopleOutline,
  IoCalendarOutline,
  IoLockClosedOutline,
  IoFolderOutline,
  IoFlagOutline,
} from "react-icons/io5";
import { HiPencil, HiTrash } from "react-icons/hi";
import { cn } from "@/lib/utils";

interface Attendee {
  name?: string;
  email: string;
  status?: AttendeeStatus;
}

interface EventQuickViewProps {
  isOpen: boolean;
  onClose: () => void;
  item:
    | (CalendarEvent & {
        attendees?: Attendee[];
        extendedProps?: { isTask?: boolean };
      })
    | (Task & { project?: { name: string; color?: string | null } | null });
  onEdit: () => void;
  onDelete: () => void;
  position: { x: number; y: number };
  isTask: boolean;
}

//TODO: move to utils
const priorityColors = {
  [Priority.HIGH]: "text-destructive dark:text-destructive",
  [Priority.MEDIUM]: "text-warning dark:text-warning",
  [Priority.LOW]: "text-primary dark:text-primary",
  [Priority.NONE]: "text-muted-foreground",
};

export function EventQuickView({
  isOpen,
  onClose,
  item,
  onEdit,
  onDelete,
  position,
  isTask,
}: EventQuickViewProps) {
  const getStatusColor = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
      case "ACCEPTED":
      case TaskStatus.COMPLETED:
        return "text-green-600 dark:text-green-400";
      case "TENTATIVE":
      case TaskStatus.IN_PROGRESS:
        return "text-warning dark:text-warning";
      case "DECLINED":
        return "text-destructive dark:text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  // Cast item to the appropriate type based on isTask
  const taskItem = isTask ? (item as Task) : null;
  const eventItem = !isTask
    ? (item as CalendarEvent & { attendees?: Attendee[] })
    : null;

  const isOverdue = taskItem && isTaskOverdue(taskItem);

  return (
    <Popover.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Popover.Portal>
        <Popover.Content
          className="rounded-lg bg-background shadow-lg border border-border w-80 p-4 z-[10000]"
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="bottom"
          align="start"
          sideOffset={5}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-foreground flex items-center gap-2 event-title">
                {item.title}
                {isTask ? (
                  <>
                    {taskItem?.isRecurring && (
                      <IoRepeat
                        className="h-4 w-4 text-primary"
                        title="Recurring task"
                      />
                    )}
                    {taskItem?.scheduleLocked && (
                      <IoLockClosedOutline
                        className="h-4 w-4 text-warning"
                        title="Schedule locked"
                      />
                    )}
                  </>
                ) : (
                  eventItem?.isRecurring && (
                    <IoRepeat
                      className="h-4 w-4 text-primary"
                      title="Recurring event"
                    />
                  )
                )}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={onEdit}
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted"
                  title="Edit"
                >
                  <HiPencil className="h-4 w-4" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted"
                  title="Delete"
                >
                  <HiTrash className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isTask && eventItem && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <IoTimeOutline className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {format(newDate(eventItem.start), "PPp")} -{" "}
                    {format(
                      newDate(eventItem.end),
                      eventItem.allDay ? "PP" : "p"
                    )}
                  </span>
                </div>
                {eventItem.location && (
                  <div className="flex items-center gap-2">
                    <IoLocationOutline className="h-4 w-4 flex-shrink-0" />
                    <span className="line-clamp-2 event-location">
                      {eventItem.location}
                    </span>
                  </div>
                )}
                {eventItem.attendees && eventItem.attendees.length > 0 && (
                  <div className="flex items-start gap-2">
                    <IoPeopleOutline className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {eventItem.attendees.map((attendee) => (
                        <div
                          key={attendee.email}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="truncate flex-1 event-attendees">
                            {attendee.name || attendee.email}
                          </span>
                          <span
                            className={cn(
                              "ml-2 flex-shrink-0",
                              getStatusColor(attendee.status)
                            )}
                          >
                            {attendee.status?.toLowerCase() || "pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {eventItem.description && (
                  <div className="text-xs mt-2 text-muted-foreground line-clamp-2 event-description">
                    {eventItem.description}
                  </div>
                )}
              </div>
            )}

            {isTask && taskItem && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IoTimeOutline className="h-4 w-4 flex-shrink-0" />
                    {taskItem.dueDate ? (
                      <span
                        className={cn(
                          isOverdue &&
                            "text-destructive dark:text-destructive font-medium"
                        )}
                      >
                        Due {format(newDate(taskItem.dueDate), "PPp")}
                        {isOverdue && " (OVERDUE)"}
                      </span>
                    ) : (
                      <span>No due date</span>
                    )}
                  </div>
                  <span
                    className={cn("text-xs px-2 py-0.5 rounded-full", {
                      "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100":
                        taskItem.status === TaskStatus.COMPLETED,
                      "bg-warning/10 text-warning":
                        taskItem.status === TaskStatus.IN_PROGRESS,
                      "bg-muted text-muted-foreground":
                        taskItem.status === TaskStatus.TODO,
                    })}
                  >
                    {taskItem.status.toLowerCase().replace("_", " ")}
                  </span>
                </div>

                {taskItem.startDate && (
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Starts {format(newDate(taskItem.startDate), "PPp")}
                    </span>
                  </div>
                )}

                {taskItem.priority && (
                  <div className="flex items-center gap-2">
                    <IoFlagOutline className="h-4 w-4 flex-shrink-0" />
                    <span
                      className={cn(
                        "text-sm",
                        priorityColors[taskItem.priority]
                      )}
                    >
                      {taskItem.priority.charAt(0).toUpperCase() +
                        taskItem.priority.slice(1)}{" "}
                      Priority
                    </span>
                  </div>
                )}

                {taskItem.isAutoScheduled &&
                  taskItem.scheduledStart &&
                  taskItem.scheduledEnd && (
                    <div className="flex items-center gap-2">
                      <IoCalendarOutline className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1">
                        <div>
                          Scheduled:{" "}
                          {format(newDate(taskItem.scheduledStart), "PPp")} -{" "}
                          {format(newDate(taskItem.scheduledEnd), "p")}
                        </div>
                        {taskItem.scheduleScore !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            Confidence:{" "}
                            {Math.round((taskItem.scheduleScore ?? 0) * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {taskItem.project && (
                  <div className="flex items-center gap-2">
                    <IoFolderOutline className="h-4 w-4 flex-shrink-0" />
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor:
                          (taskItem.project.color || "hsl(var(--primary))") +
                          "20",
                        color: taskItem.project.color || "hsl(var(--primary))",
                      }}
                    >
                      {taskItem.project.name}
                    </span>
                  </div>
                )}

                {taskItem.duration && (
                  <div className="flex items-center gap-2">
                    <IoTimeOutline className="h-4 w-4 flex-shrink-0" />
                    <span>Duration: {taskItem.duration} minutes</span>
                  </div>
                )}

                {taskItem.tags && taskItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {taskItem.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                        style={{
                          backgroundColor:
                            (tag.color || "hsl(var(--primary))") + "20",
                          color: tag.color || "hsl(var(--primary))",
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {taskItem.description && (
                  <div className="text-xs mt-2 text-muted-foreground line-clamp-2 task-description">
                    {taskItem.description}
                  </div>
                )}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
