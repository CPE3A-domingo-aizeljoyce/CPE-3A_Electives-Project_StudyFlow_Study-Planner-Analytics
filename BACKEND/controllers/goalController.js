import Goal from '../models/goalModel.js';

export const createGoal = async (req, res) => {
  try {
    const { title, category, timeframe, targetAmount, unit, deadline, color } = req.body;

    const goal = await Goal.create({
      user: req.user.id, 
      title,
      category,
      timeframe,
      targetAmount,
      unit,
      deadline,
      color
    });

    res.status(201).json(goal);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.id });
    res.status(200).json(goals);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};