import { COLUMN_ORDER } from '../constants/colors';
import { getTaskPoints } from '../constants/task';

export function calculateCfdData(data) {
        const allEvents = data.events || [];
        const initialTasks = data.tasks || [];

        if (initialTasks.length === 0) return [];

        const validTimestamps = initialTasks
                .map((task) => new Date(task.created_at).getTime())
                .concat(allEvents.map((event) => new Date(event.time).getTime()))
                .filter((timestamp) => !isNaN(timestamp));

        if (validTimestamps.length === 0) return [];

        const startTime = new Date(Math.min(...validTimestamps));
        startTime.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const dates = [];
        let currentDate = startTime;

        while (currentDate.getTime() <= now.getTime()) {
                dates.push(currentDate.toISOString().slice(0, 10));
                currentDate.setDate(currentDate.getDate() + 1);
        }

        const tasksLog = {};
        initialTasks.forEach((task) => {
                if (!COLUMN_ORDER.includes(task.status)) return;
                if (!task.created_at || isNaN(new Date(task.created_at).getTime())) return;
                tasksLog[task.id] = {
                        status: task.status,
                        created_at: task.created_at,
                        statusHistory: [{ date: task.created_at.slice(0, 10), status: task.status }],
                        level: task.level,
                };
        });

        const moveEvents = allEvents
                .filter((event) => event.type === 'move' || event.type === 'complete' || event.type === 'new')
                .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        moveEvents.forEach((event) => {
                const task = tasksLog[event.task_id];
                if (!task) return;
                const newStatus = event.to || (event.type === 'complete' ? 'Done' : null);
                if (newStatus && COLUMN_ORDER.includes(newStatus) && newStatus !== task.status && event.time) {
                        task.statusHistory.push({ date: event.time.slice(0, 10), status: newStatus });
                        task.status = newStatus;
                }
        });

        return dates.map((dateStr) => {
                const dayData = { date: dateStr };
                const dateLimit = new Date(dateStr).getTime() + 86400000;

                COLUMN_ORDER.forEach((column) => {
                        dayData[column] = 0;
                });

                Object.values(tasksLog).forEach((task) => {
                        const createdTime = new Date(task.created_at).getTime();
                        if (createdTime > dateLimit) return;

                        let statusOnDay = null;
                        task.statusHistory.forEach((history) => {
                                if (new Date(history.date).getTime() < dateLimit) {
                                        statusOnDay = history.status;
                                }
                        });

                        if (statusOnDay && COLUMN_ORDER.includes(statusOnDay) && dayData.hasOwnProperty(statusOnDay)) {
                                dayData[statusOnDay] += getTaskPoints(task.level);
                        }
                });

                return dayData;
        });
}

export function calculateBurndownData(data) {
        const tasks = data.tasks || [];
        const events = data.events || [];

        const allDates = tasks
                .map((task) => (task.created_at ? new Date(task.created_at).getTime() : null))
                .filter((timestamp) => !isNaN(timestamp));

        if (allDates.length === 0) return [];

        const projectStartDay = new Date(Math.min(...allDates));
        projectStartDay.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dates = [];
        let currentDate = projectStartDay;

        while (currentDate.getTime() <= today.getTime()) {
                dates.push(currentDate.toISOString().slice(0, 10));
                currentDate.setDate(currentDate.getDate() + 1);
        }

        const taskCompletionTimes = {};

        tasks.forEach((task) => {
                if (task.finished_at && task.status === 'Done') {
                        taskCompletionTimes[task.id] = task.finished_at;
                }
        });

        events
                .filter((event) => event.type === 'complete' || (event.type === 'move' && event.to === 'Done'))
                .forEach((event) => {
                        if (event.task_id) taskCompletionTimes[event.task_id] = event.time;
                });

        return dates.map((dateStr) => {
                const dayLimit = new Date(dateStr).getTime() + 86400000;

                let scopeOnDay = 0;
                tasks.forEach((task) => {
                        if (task.created_at && new Date(task.created_at).getTime() < dayLimit) {
                                scopeOnDay += getTaskPoints(task.level);
                        }
                });

                let completedOnDay = 0;
                Object.keys(taskCompletionTimes).forEach((taskId) => {
                        const completionTime = new Date(taskCompletionTimes[taskId]).getTime();
                        if (completionTime < dayLimit) {
                                const completedTask = tasks.find((task) => task.id === taskId);
                                if (completedTask) {
                                        completedOnDay += getTaskPoints(completedTask.level);
                                }
                        }
                });

                const remaining = scopeOnDay - completedOnDay;

                return {
                        date: dateStr,
                        remaining: remaining > 0 ? remaining : 0,
                        scope: scopeOnDay,
                };
        });
}
