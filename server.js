const express = require("express");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const { Server } = require("ws");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// In-memory data storage
const habits = [];
const reminders = [];
let idCounter = 1;

// WebSocket server
const wss = new Server({ port: 3001 }, () => {
  console.log("WebSocket server running on ws://localhost:3001");
});

// Utility function for today's date
const getToday = () => new Date().toISOString().split("T")[0];

// Add habit endpoint
app.post("/habits", (req, res) => {
  const { name, dailyGoal } = req.body;
  if (!name || !dailyGoal) {
    return res
      .status(400)
      .json({ message: "Name and daily goal are required" });
  }

  const habit = {
    id: idCounter++,
    name,
    dailyGoal,
    completion: {},
  };
  habits.push(habit);
  res.status(201).json({ message: "Habit added successfully", habit });
});

// Update habit endpoint
app.put("/habits/:id", (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const habit = habits.find((h) => h.id === habitId);

  if (!habit) {
    return res.status(404).json({ message: "Habit not found" });
  }

  const today = getToday();
  habit.completion[today] = true;
  res.json({ message: "Habit marked as complete for today", habit });
});

// Get all habits endpoint
app.get("/habits", (req, res) => {
  res.json(habits);
});

// Weekly report endpoint
app.get("/habits/report", (req, res) => {
  const today = new Date();
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const report = habits.map((habit) => {
    const weekCompletion = Object.entries(habit.completion).filter(([date]) => {
      const habitDate = new Date(date);
      return habitDate >= startOfWeek;
    }).length;

    return {
      id: habit.id,
      name: habit.name,
      weeklyCompletion: weekCompletion,
    };
  });

  res.json(report);
});

// CRON job for daily reminders
cron.schedule("0 9 * * *", () => {
  const incompleteHabits = habits.filter(
    (habit) => !habit.completion[getToday()]
  );
  if (incompleteHabits.length > 0) {
    reminders.push(
      ...incompleteHabits.map((habit) => `Reminder: ${habit.name}`)
    );
    broadcastReminders();
  }
  console.log("Daily reminders sent.");
});

// WebSocket message broadcasting
const broadcastReminders = () => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ reminders }));
    }
  });
};

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
