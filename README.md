# My Drobe

An AI-powered digital wardrobe helper designed to organize clothing items and give contextual shopping recommendations based on what you already own.

👉 **[Live Demo](https://seam-1q3l.vercel.app/home)**

## Why I built this
I built this to solve a personal frustration: I was tired of keeping track of potential clothes shopping items by saving links individually in a browser bookmark folder. I wanted to see all my items altogether on one single page. Ultimately, the goal was to create a tool that helps me look at my existing wardrobe as a whole to stop impulse shopping and make more intentional buying decisions.

## Features
* **Web scraping integration:** Pulls item details straight from online retail pages.
* **Contextual matchmaker:** Uses AI to weigh user budget and style inputs against existing wardrobe data.
* **Smart recommendations:** Suggests whether an item actually fits your current collection before you buy it.

## Tech Stack
React (Vite), TypeScript, Node.js, Express, Claude API, Tailwind CSS

## Key Learnings
* **Web scraping nuances:** Learned how to extract clean data (like product names, prices, brands, and images) across different website layouts and structures.
* **Combining data streams:** Successfully wired together automated data extraction, manual user inputs, and LLM reasoning to generate cohesive, accurate purchase advice.
