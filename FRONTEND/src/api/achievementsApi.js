import axios from 'axios';

// 🌟 FIXED: Relative path
const API_URL = '/api/achievements';

const getConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

export const fetchAchievements = async () => {
  const res = await axios.get(API_URL, getConfig());
  return res.data;
};

export const triggerAchievementCheck = async () => {
  const res = await axios.post(`${API_URL}/check`, {}, getConfig());
  return res.data;
};