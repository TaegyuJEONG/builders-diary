import { Portfolio } from '@/lib/types';

const CACHE_KEY = 'builders-diary-portfolio-cache';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export function getCachedPortfolio(): Portfolio | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

export function setCachedPortfolio(portfolio: Portfolio): void {
  try {
    const cached = {
      data: portfolio,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}
