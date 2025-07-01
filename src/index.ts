import { HTML_CONTENT } from '../html/html-content';
import { CSS_CONTENT } from '../styles/main.css.js';

// Cloudflare Worker for Hand-Based AI Fruit Catching Game with Leaderboard
export interface Env {
	DB: D1Database; // Cloudflare D1 database binding
	LEADERBOARD?: DurableObjectNamespace; // Fallback to Durable Object
  }
  
  interface ScoreBody {
	username: string;
	score: number;
	time: number;
  }
  
  export default {
	async fetch(request: Request, env: Env): Promise<Response> {
	  const url = new URL(request.url);
	  
	  if (url.pathname === '/') {
		return new Response(HTML_CONTENT, {
		  headers: { 'Content-Type': 'text/html' }
		});
	  }
	  if (url.pathname === '/styles/main.css') {
		return new Response(CSS_CONTENT, {
			headers: { 'Content-Type': 'text/css' }
		});
	}
	  
	  // API endpoint to save score
	  if (url.pathname === '/api/save-score' && request.method === 'POST') {
		try {
		  const body = await request.json() as ScoreBody;
		  const { username, score, time } = body;
		  
		  // Validate input
		  if (!username || typeof score !== 'number' || typeof time !== 'number') {
			return new Response('Invalid data', { status: 400 });
		  }
		  
		  // Try D1 first
		  if (env.DB) {
			try {
			  // Always insert new record for each game session
			  await env.DB.prepare(
				'INSERT INTO leaderboard (username, score, time, date) VALUES (?, ?, ?, ?)'
			  ).bind(
				username.slice(0, 20), 
				score, 
				time, 
				new Date().toISOString()
			  ).run();
			  
			  return new Response('Score saved to D1', { status: 200 });
			} catch (dbError) {
			  console.error('D1 Error:', dbError);
			  return new Response('Database error', { status: 500 });
			}
		  }
		  
		  // Fallback if no DB available
		  return new Response('Score saved (no database)', { status: 200 });
		  
		} catch (error) {
		  console.error('Error saving score:', error);
		  return new Response('Error saving score', { status: 500 });
		}
	  }
	  
	  // API endpoint to get leaderboard
	  if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
		try {
		  // Try D1 first
		  if (env.DB) {
			try {
			  const result = await env.DB.prepare(
				'SELECT username, score, time, date FROM leaderboard ORDER BY score DESC, time ASC LIMIT 10'
			  ).all();
			  
			  return new Response(JSON.stringify(result.results), {
				headers: { 'Content-Type': 'application/json' }
			  });
			} catch (dbError) {
			  console.error('D1 Error:', dbError);
			  // Fall through to demo data
			}
		  }
		  
		  // Demo mode - return sample leaderboard data
		  const demoLeaderboard = [
			{ username: "SpeedyHands", score: 20, time: 45, date: new Date().toISOString() },
			{ username: "FruitMaster", score: 20, time: 52, date: new Date().toISOString() },
			{ username: "SwipeKing", score: 20, time: 58, date: new Date().toISOString() },
			{ username: "QuickCatch", score: 19, time: 40, date: new Date().toISOString() },
			{ username: "HandsOfSteel", score: 18, time: 35, date: new Date().toISOString() }
		  ];
		  
		  return new Response(JSON.stringify(demoLeaderboard), {
			headers: { 'Content-Type': 'application/json' }
		  });
		  
		} catch (error) {
		  console.error('Error fetching leaderboard:', error);
		  return new Response('Error fetching leaderboard', { status: 500 });
		}
	  }
	  
	  return new Response('Not Found', { status: 404 });
	}
  };