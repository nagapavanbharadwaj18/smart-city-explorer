# Smart City Explorer

An AI-powered city exploration assistant that helps travelers discover what they can realistically explore based on their available time, budget, location, and transportation options.

## Problem

When visiting an unfamiliar city with only a few free hours, it can be difficult to decide which places are practical to visit while staying within a fixed budget and returning on time.

Smart City Explorer addresses this problem by combining destination recommendations with time, cost, transportation, and return-deadline constraints.

## Solution

Smart City Explorer recommends places based on the user's situation and checks whether the selected plan fits the chosen constraints.

> **AI recommends. The system checks feasibility using planning estimates.**

The application does not claim to verify live traffic, real-time availability, delays, or guaranteed arrival times.

## Key Features

- Time and budget-aware recommendations
- Location-based destination discovery
- Destination selection
- Multiple transportation options
- Route and distance estimation
- Visit-duration estimation
- Budget estimation
- Return-deadline checking
- Feasibility analysis
- Alternative plans
- Interactive map

## How It Works

1. Choose a starting location
2. Enter available time and budget
3. Discover destinations
4. Select destinations
5. Choose transportation
6. Check feasibility
7. Generate an itinerary

## Technology Stack

- React
- TypeScript
- Vite
- Google AI Studio / Gemini
- Maps and location services
- CSS

## Project Structure

```text
src/
├── components/       # Application UI components
├── data/             # Location and planning data
├── services/         # Location, route, fare and recommendation services
├── utils/            # Calculation and validation utilities
├── feasibility.ts    # Constraint and feasibility engine
├── types.ts          # Shared TypeScript types
└── App.tsx           # Main application
