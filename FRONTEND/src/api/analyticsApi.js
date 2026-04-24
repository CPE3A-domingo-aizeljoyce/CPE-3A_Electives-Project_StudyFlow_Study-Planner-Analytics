import axios from 'axios';

// 🌟 FIXED: Relative path
const BASE_URL = '/api';

export const fetchAnalyticsData = async (timeframe = 'weekly') => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.get(`${BASE_URL}/study-timer/analytics?timeframe=${timeframe}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
 
    return response.data || [];
  } catch (error) {
    console.error("API Error fetching analytics:", error);
    return [];
  }
};