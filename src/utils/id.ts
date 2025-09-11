import { v4 as uuidv4 } from 'uuid';

export function generateClickId(): string {
  return uuidv4();
}

export function generateCampaignId(): string {
  // Generate a shorter, URL-friendly ID for campaigns
  return Math.random().toString(36).substring(2, 10);
}